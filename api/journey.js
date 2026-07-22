import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';
const NEEDS = new Set(['cariño', 'hablar', 'espacio', 'apoyo', 'divertirnos', 'descansar', 'planear']);
const EMOJIS = new Set(['💌', '💜', '🌹', '✨', '🌙', '🌻', '🎁', '🫶']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeMatch(a, b) {
  const left = Buffer.from(sha256(a), 'hex');
  const right = Buffer.from(sha256(b), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function cookies(req) {
  const output = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) output[name] = decodeURIComponent(value);
  }
  return output;
}

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

async function currentUser(req, sql) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const rows = await sql`
    select u.id, u.display_name, u.avatar
    from public.sessions s
    join public.users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)}
      and s.revoked_at is null
      and s.expires_at > now()
      and u.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function coupleContext(sql, userId) {
  const rows = await sql`
    select c.id as couple_id,
           c.relationship_date,
           (select cm2.user_id from public.couple_members cm2
            where cm2.couple_id = c.id and cm2.user_id <> ${userId}::uuid limit 1) as partner_id
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid and c.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function ensureJourney(sql) {
  await sql`
    create table if not exists public.journey_mission_completions (
      couple_id uuid not null references public.couples(id) on delete cascade,
      mission_date date not null,
      mission_key varchar(50) not null,
      user_id uuid not null references public.users(id) on delete cascade,
      completed_at timestamptz not null default now(),
      primary key (couple_id, mission_date, mission_key, user_id)
    )
  `;
  await sql`
    create table if not exists public.journey_checkins (
      couple_id uuid not null references public.couples(id) on delete cascade,
      week_start date not null,
      user_id uuid not null references public.users(id) on delete cascade,
      closeness smallint not null check (closeness between 1 and 5),
      energy smallint not null check (energy between 1 and 5),
      need varchar(30) not null default 'cariño',
      note varchar(180) not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (couple_id, week_start, user_id)
    )
  `;
  await sql`
    create table if not exists public.journey_capsules (
      id uuid primary key default gen_random_uuid(),
      couple_id uuid not null references public.couples(id) on delete cascade,
      sender_id uuid not null references public.users(id) on delete cascade,
      recipient_id uuid not null references public.users(id) on delete cascade,
      title varchar(80) not null,
      capsule_message varchar(1200) not null,
      emoji varchar(12) not null default '💌',
      media_url text,
      unlock_at timestamptz not null,
      opened_at timestamptz,
      created_at timestamptz not null default now(),
      constraint journey_capsule_title_not_blank check (length(trim(title)) > 0),
      constraint journey_capsule_message_not_blank check (length(trim(capsule_message)) > 0)
    )
  `;
  await sql`create index if not exists journey_missions_date_idx on public.journey_mission_completions (couple_id, mission_date desc)`;
  await sql`create index if not exists journey_checkins_week_idx on public.journey_checkins (couple_id, week_start desc)`;
  await sql`create index if not exists journey_capsules_unlock_idx on public.journey_capsules (couple_id, unlock_at desc)`;
}

async function snapshot(sql, context, user) {
  const [missionRows, checkins, capsules, totals, weekly] = await Promise.all([
    sql`
      select j.mission_key, j.user_id, j.completed_at, u.display_name, u.avatar
      from public.journey_mission_completions j
      join public.users u on u.id = j.user_id
      where j.couple_id = ${context.couple_id}::uuid and j.mission_date = current_date
      order by j.completed_at asc
    `,
    sql`
      select c.user_id, c.closeness, c.energy, c.need, c.note, c.updated_at,
             u.display_name, u.avatar
      from public.journey_checkins c
      join public.users u on u.id = c.user_id
      where c.couple_id = ${context.couple_id}::uuid
        and c.week_start = date_trunc('week', now())::date
      order by c.updated_at asc
    `,
    sql`
      select c.id, c.sender_id, c.recipient_id, c.title, c.emoji, c.unlock_at,
             c.opened_at, c.created_at,
             (c.unlock_at <= now()) as is_unlocked,
             case when c.unlock_at <= now() then c.capsule_message else null end as capsule_message,
             case when c.unlock_at <= now() then c.media_url else null end as media_url,
             sender.display_name as sender_name, recipient.display_name as recipient_name
      from public.journey_capsules c
      join public.users sender on sender.id = c.sender_id
      join public.users recipient on recipient.id = c.recipient_id
      where c.couple_id = ${context.couple_id}::uuid
        and (c.sender_id = ${user.id}::uuid or c.recipient_id = ${user.id}::uuid)
      order by c.unlock_at desc
      limit 24
    `,
    sql`
      select
        (select count(*)::int from public.messages where couple_id = ${context.couple_id}::uuid and deleted_at is null) as messages,
        (select count(*)::int from public.memories where couple_id = ${context.couple_id}::uuid) as memories,
        (select count(*)::int from public.calls where couple_id = ${context.couple_id}::uuid and status in ('active','ended')) as calls,
        (select count(*)::int from public.couple_notes where couple_id = ${context.couple_id}::uuid) as notes,
        (select count(*)::int from public.journey_mission_completions where couple_id = ${context.couple_id}::uuid) as missions,
        (select count(*)::int from public.journey_checkins where couple_id = ${context.couple_id}::uuid) as checkins,
        (select coalesce(sum(games_count),0)::int from public.daily_activity where couple_id = ${context.couple_id}::uuid) as games
    `,
    sql`
      select
        coalesce(sum(messages_count),0)::int as messages,
        coalesce(sum(memories_count),0)::int as memories,
        coalesce(sum(games_count),0)::int as games,
        coalesce(sum(calls_count),0)::int as calls
      from public.daily_activity
      where couple_id = ${context.couple_id}::uuid
        and activity_date >= date_trunc('week', now())::date
    `,
  ]);

  const total = totals[0] || {};
  const points = Math.min(Number(total.messages || 0), 400)
    + Number(total.memories || 0) * 12
    + Number(total.calls || 0) * 8
    + Number(total.notes || 0) * 5
    + Number(total.missions || 0) * 15
    + Number(total.checkins || 0) * 10
    + Number(total.games || 0) * 3;
  const levels = [0, 80, 200, 420, 750, 1200, 1900, 2800];
  let level = levels.findIndex((threshold) => points < threshold) - 1;
  if (level < 0) level = levels.length - 1;
  level = Math.max(0, Math.min(level, levels.length - 2));
  const currentFloor = levels[level];
  const nextFloor = levels[level + 1];
  const progress = Math.max(0, Math.min(100, Math.round(((points - currentFloor) / Math.max(1, nextFloor - currentFloor)) * 100)));

  return {
    ok: true,
    serverDate: new Date().toISOString().slice(0, 10),
    weekStart: new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString(),
    relationshipDate: context.relationship_date,
    partnerId: context.partner_id,
    missionCompletions: missionRows,
    checkins,
    capsules,
    garden: { points, level, progress, nextAt: nextFloor },
    weekly: weekly[0] || { messages: 0, memories: 0, games: 0, calls: 0 },
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (!safeMatch(cookies(req)[ACCESS_COOKIE] || '', AUTHORIZED_GATE_TOKEN)) {
    return send(res, 403, { ok: false, error: 'ACCESS_CODE_REQUIRED' });
  }
  if (!process.env.DATABASE_URL) return send(res, 503, { ok: false, error: 'DATABASE_URL_MISSING' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    const user = await currentUser(req, sql);
    if (!user) return send(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    const context = await coupleContext(sql, user.id);
    if (!context) return send(res, 409, { ok: false, error: 'NO_DUKE_SPACE' });
    await ensureJourney(sql);

    const input = bodyOf(req);
    const action = clean(req.query?.action || input.action, 30);

    if (action === 'snapshot') return send(res, 200, await snapshot(sql, context, user));

    if (action === 'mission') {
      const missionKey = clean(input.missionKey, 50);
      const completed = Boolean(input.completed);
      if (!missionKey) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      if (completed) {
        await sql`
          insert into public.journey_mission_completions (couple_id, mission_date, mission_key, user_id)
          values (${context.couple_id}::uuid, current_date, ${missionKey}, ${user.id}::uuid)
          on conflict do nothing
        `;
      } else {
        await sql`
          delete from public.journey_mission_completions
          where couple_id = ${context.couple_id}::uuid and mission_date = current_date
            and mission_key = ${missionKey} and user_id = ${user.id}::uuid
        `;
      }
      return send(res, 200, await snapshot(sql, context, user));
    }

    if (action === 'checkin') {
      const closeness = Math.max(1, Math.min(5, Number.parseInt(String(input.closeness), 10) || 3));
      const energy = Math.max(1, Math.min(5, Number.parseInt(String(input.energy), 10) || 3));
      const need = NEEDS.has(input.need) ? input.need : 'cariño';
      const note = clean(input.note, 180);
      await sql`
        insert into public.journey_checkins (couple_id, week_start, user_id, closeness, energy, need, note)
        values (${context.couple_id}::uuid, date_trunc('week', now())::date, ${user.id}::uuid,
                ${closeness}, ${energy}, ${need}, ${note})
        on conflict (couple_id, week_start, user_id) do update set
          closeness = excluded.closeness,
          energy = excluded.energy,
          need = excluded.need,
          note = excluded.note,
          updated_at = now()
      `;
      return send(res, 200, await snapshot(sql, context, user));
    }

    if (action === 'capsule_create') {
      if (!context.partner_id) return send(res, 409, { ok: false, error: 'PARTNER_NOT_CONNECTED' });
      const title = clean(input.title, 80);
      const message = clean(input.message, 1200);
      const emoji = EMOJIS.has(input.emoji) ? input.emoji : '💌';
      const rawUnlock = clean(input.unlockAt, 50);
      const unlockTime = Date.parse(rawUnlock);
      const mediaUrl = String(input.mediaUrl || '').trim().slice(0, 2_800_000) || null;
      if (!title || !message || Number.isNaN(unlockTime) || unlockTime < Date.now() + 60_000) {
        return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      }
      if (unlockTime > Date.now() + 5 * 365 * 86400000) {
        return send(res, 400, { ok: false, error: 'DATE_TOO_FAR' });
      }
      if (mediaUrl && !mediaUrl.startsWith('data:image/')) {
        return send(res, 400, { ok: false, error: 'INVALID_MEDIA' });
      }
      const rows = await sql`
        insert into public.journey_capsules
          (couple_id, sender_id, recipient_id, title, capsule_message, emoji, media_url, unlock_at)
        values
          (${context.couple_id}::uuid, ${user.id}::uuid, ${context.partner_id}::uuid,
           ${title}, ${message}, ${emoji}, ${mediaUrl}, ${new Date(unlockTime).toISOString()})
        returning id, title, emoji, unlock_at, created_at
      `;
      await sql`
        insert into public.notifications (couple_id, sender_id, recipient_id, notification_type, title, body, data)
        values (${context.couple_id}::uuid, ${user.id}::uuid, ${context.partner_id}::uuid, 'system',
                ${`${user.display_name} guardó una cápsula para ustedes`},
                ${`Se abrirá el ${new Date(unlockTime).toLocaleDateString('es')}`},
                ${JSON.stringify({ type: 'journey_capsule', capsuleId: rows[0].id })}::jsonb)
      `.catch(() => {});
      return send(res, 201, { ok: true, capsule: rows[0] });
    }

    if (action === 'capsule_open') {
      const capsuleId = clean(input.capsuleId, 36);
      if (!/^[0-9a-f-]{36}$/i.test(capsuleId)) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      await sql`
        update public.journey_capsules set opened_at = coalesce(opened_at, now())
        where id = ${capsuleId}::uuid and couple_id = ${context.couple_id}::uuid
          and recipient_id = ${user.id}::uuid and unlock_at <= now()
      `;
      return send(res, 200, await snapshot(sql, context, user));
    }

    return send(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke journey API error:', error);
    return send(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
