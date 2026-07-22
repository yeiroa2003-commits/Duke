import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';
const COLORS = new Set(['violet', 'rose', 'blue', 'gold', 'green']);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeMatch(a, b) {
  const left = Buffer.from(sha256(a), 'hex');
  const right = Buffer.from(sha256(b), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function cookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}

function inputOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function clean(value, max = 280) {
  return String(value ?? '').trim().slice(0, max);
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
           (select cm2.user_id from public.couple_members cm2
            where cm2.couple_id = c.id and cm2.user_id <> ${userId}::uuid limit 1) as partner_id
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid and c.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function ensureNotes(sql) {
  await sql`
    create table if not exists public.couple_notes (
      id uuid primary key default gen_random_uuid(),
      couple_id uuid not null references public.couples(id) on delete cascade,
      sender_id uuid not null references public.users(id) on delete cascade,
      recipient_id uuid not null references public.users(id) on delete cascade,
      note_text varchar(280) not null,
      color varchar(20) not null default 'violet',
      remind_at timestamptz,
      seen_at timestamptz,
      dismissed_at timestamptz,
      created_at timestamptz not null default now(),
      constraint couple_notes_text_not_blank check (length(trim(note_text)) > 0)
    )
  `;
  await sql`create index if not exists couple_notes_recipient_idx on public.couple_notes (recipient_id, dismissed_at, remind_at, created_at desc)`;
  await sql`create index if not exists couple_notes_sender_idx on public.couple_notes (sender_id, created_at desc)`;
  await sql`delete from public.couple_notes where dismissed_at is not null and dismissed_at < now() - interval '30 days'`;
}

function send(res, status, payload) {
  res.status(status).json(payload);
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
    await ensureNotes(sql);

    const input = inputOf(req);
    const action = clean(req.query?.action || input.action, 30);

    if (action === 'list') {
      const [received, sent] = await Promise.all([
        sql`
          select n.id, n.note_text, n.color, n.remind_at, n.seen_at, n.created_at,
                 u.display_name as sender_name, u.avatar as sender_avatar
          from public.couple_notes n
          join public.users u on u.id = n.sender_id
          where n.couple_id = ${context.couple_id}::uuid
            and n.recipient_id = ${user.id}::uuid
            and n.dismissed_at is null
            and (n.remind_at is null or n.remind_at <= now())
          order by coalesce(n.remind_at, n.created_at) desc
          limit 20
        `,
        sql`
          select n.id, n.note_text, n.color, n.remind_at, n.seen_at, n.dismissed_at, n.created_at,
                 u.display_name as recipient_name
          from public.couple_notes n
          join public.users u on u.id = n.recipient_id
          where n.couple_id = ${context.couple_id}::uuid
            and n.sender_id = ${user.id}::uuid
          order by n.created_at desc
          limit 12
        `,
      ]);
      return send(res, 200, { ok: true, received, sent });
    }

    if (action === 'create') {
      if (!context.partner_id) return send(res, 409, { ok: false, error: 'PARTNER_NOT_CONNECTED' });
      const text = clean(input.text, 280);
      const color = COLORS.has(input.color) ? input.color : 'violet';
      const rawRemindAt = clean(input.remindAt, 40);
      const remindAt = rawRemindAt && !Number.isNaN(Date.parse(rawRemindAt)) ? new Date(rawRemindAt).toISOString() : null;
      if (!text) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      const rows = await sql`
        insert into public.couple_notes (couple_id, sender_id, recipient_id, note_text, color, remind_at)
        values (${context.couple_id}::uuid, ${user.id}::uuid, ${context.partner_id}::uuid, ${text}, ${color}, ${remindAt})
        returning id, note_text, color, remind_at, created_at
      `;
      await sql`
        insert into public.notifications (couple_id, sender_id, recipient_id, notification_type, title, body, data)
        values (${context.couple_id}::uuid, ${user.id}::uuid, ${context.partner_id}::uuid, 'system',
                ${`${user.display_name} te dejó una nota`}, ${text.slice(0, 120)},
                ${JSON.stringify({ noteId: rows[0].id, type: 'partner_note' })}::jsonb)
      `.catch(() => {});
      return send(res, 201, { ok: true, note: rows[0] });
    }

    const noteId = clean(input.noteId, 36);
    if (!/^[0-9a-f-]{36}$/i.test(noteId)) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });

    if (action === 'seen') {
      await sql`
        update public.couple_notes set seen_at = coalesce(seen_at, now())
        where id = ${noteId}::uuid and recipient_id = ${user.id}::uuid and couple_id = ${context.couple_id}::uuid
      `;
      return send(res, 200, { ok: true });
    }

    if (action === 'dismiss') {
      await sql`
        update public.couple_notes set seen_at = coalesce(seen_at, now()), dismissed_at = now()
        where id = ${noteId}::uuid and recipient_id = ${user.id}::uuid and couple_id = ${context.couple_id}::uuid
      `;
      return send(res, 200, { ok: true });
    }

    if (action === 'delete') {
      await sql`
        delete from public.couple_notes
        where id = ${noteId}::uuid and couple_id = ${context.couple_id}::uuid
          and (sender_id = ${user.id}::uuid or recipient_id = ${user.id}::uuid)
      `;
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke notes API error:', error);
    return send(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
