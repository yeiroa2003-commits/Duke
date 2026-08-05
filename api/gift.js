import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';
const THEMES = new Set(['cinema', 'romantic', 'midnight', 'sunset']);
const MEDIA_TYPES = new Set(['image', 'video', 'none']);

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

function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function send(res, status, payload) {
  res.status(status).json(payload);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function validHttps(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAudio(value, maxLength = 2_400_000) {
  const audio = String(value || '').trim();
  if (!audio) return null;
  if (audio.length > maxLength) throw new Error('MEDIA_TOO_LARGE');
  if (audio.startsWith('data:audio/') || validHttps(audio)) return audio;
  throw new Error('INVALID_AUDIO');
}

function validateMedia(value, type) {
  const media = String(value || '').trim();
  if (!media || type === 'none') return null;
  if (media.length > 1_500_000) throw new Error('MEDIA_TOO_LARGE');
  if (type === 'image' && (media.startsWith('data:image/') || validHttps(media))) return media;
  if (type === 'video' && validHttps(media)) return media;
  throw new Error('INVALID_MEDIA');
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
           c.name as couple_name,
           (select u.display_name
              from public.couple_members cm2
              join public.users u on u.id = cm2.user_id
             where cm2.couple_id = c.id and cm2.user_id <> ${userId}::uuid
             limit 1) as partner_name
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid and c.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function ensureGiftTables(sql) {
  await sql`
    create table if not exists public.gift_story_settings (
      couple_id uuid primary key references public.couples(id) on delete cascade,
      title varchar(90) not null default 'Regalo para ti',
      subtitle varchar(180) not null default 'Nuestra historia, contada con el corazón',
      dedication varchar(900) not null default '',
      background_audio text,
      background_audio_name varchar(120) not null default '',
      theme varchar(20) not null default 'cinema',
      slide_seconds smallint not null default 8 check (slide_seconds between 4 and 20),
      enabled boolean not null default true,
      updated_by uuid references public.users(id) on delete set null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists public.gift_story_slides (
      id uuid primary key default gen_random_uuid(),
      couple_id uuid not null references public.couples(id) on delete cascade,
      created_by uuid not null references public.users(id) on delete cascade,
      position integer not null default 1,
      title varchar(100) not null default '',
      story_text varchar(1200) not null default '',
      date_label varchar(60) not null default '',
      media_type varchar(12) not null default 'none' check (media_type in ('image', 'video', 'none')),
      media_url text,
      narration_url text,
      narration_name varchar(120) not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists gift_story_slides_order_idx on public.gift_story_slides (couple_id, position, created_at)`;
}

async function snapshot(sql, context) {
  const [settingsRows, slides] = await Promise.all([
    sql`
      select title, subtitle, dedication, background_audio, background_audio_name,
             theme, slide_seconds, enabled, updated_at
      from public.gift_story_settings
      where couple_id = ${context.couple_id}::uuid
      limit 1
    `,
    sql`
      select id, position, title, story_text, date_label, media_type, media_url,
             narration_url, narration_name, created_at, updated_at
      from public.gift_story_slides
      where couple_id = ${context.couple_id}::uuid
      order by position asc, created_at asc
      limit 40
    `,
  ]);

  return {
    ok: true,
    partnerName: context.partner_name || 'tu pareja',
    coupleName: context.couple_name || 'Duke',
    settings: settingsRows[0] || {
      title: 'Regalo para ti',
      subtitle: 'Nuestra historia, contada con el corazón',
      dedication: '',
      background_audio: null,
      background_audio_name: '',
      theme: 'cinema',
      slide_seconds: 8,
      enabled: true,
    },
    slides,
  };
}

async function compactPositions(sql, coupleId) {
  await sql`
    with ordered as (
      select id, row_number() over (order by position asc, created_at asc)::int as next_position
      from public.gift_story_slides
      where couple_id = ${coupleId}::uuid
    )
    update public.gift_story_slides s
       set position = o.next_position
      from ordered o
     where s.id = o.id and s.position <> o.next_position
  `;
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
    await ensureGiftTables(sql);

    const input = bodyOf(req);
    const action = clean(req.query?.action || input.action, 30);

    if (action === 'snapshot') return send(res, 200, await snapshot(sql, context));

    if (action === 'save_settings') {
      const title = clean(input.title, 90) || 'Regalo para ti';
      const subtitle = clean(input.subtitle, 180);
      const dedication = clean(input.dedication, 900);
      const theme = THEMES.has(input.theme) ? input.theme : 'cinema';
      const seconds = Math.max(4, Math.min(20, Number.parseInt(String(input.slideSeconds), 10) || 8));
      const enabled = input.enabled !== false;
      const audioName = clean(input.backgroundAudioName, 120);
      const clearAudio = Boolean(input.clearAudio);
      const backgroundAudio = clearAudio ? null : (input.backgroundAudio === undefined
        ? undefined
        : validateAudio(input.backgroundAudio));

      if (backgroundAudio === undefined) {
        await sql`
          insert into public.gift_story_settings
            (couple_id, title, subtitle, dedication, theme, slide_seconds, enabled, updated_by)
          values
            (${context.couple_id}::uuid, ${title}, ${subtitle}, ${dedication}, ${theme}, ${seconds}, ${enabled}, ${user.id}::uuid)
          on conflict (couple_id) do update set
            title = excluded.title,
            subtitle = excluded.subtitle,
            dedication = excluded.dedication,
            theme = excluded.theme,
            slide_seconds = excluded.slide_seconds,
            enabled = excluded.enabled,
            updated_by = excluded.updated_by,
            updated_at = now()
        `;
      } else {
        await sql`
          insert into public.gift_story_settings
            (couple_id, title, subtitle, dedication, background_audio, background_audio_name,
             theme, slide_seconds, enabled, updated_by)
          values
            (${context.couple_id}::uuid, ${title}, ${subtitle}, ${dedication}, ${backgroundAudio},
             ${clearAudio ? '' : audioName}, ${theme}, ${seconds}, ${enabled}, ${user.id}::uuid)
          on conflict (couple_id) do update set
            title = excluded.title,
            subtitle = excluded.subtitle,
            dedication = excluded.dedication,
            background_audio = excluded.background_audio,
            background_audio_name = excluded.background_audio_name,
            theme = excluded.theme,
            slide_seconds = excluded.slide_seconds,
            enabled = excluded.enabled,
            updated_by = excluded.updated_by,
            updated_at = now()
        `;
      }
      return send(res, 200, await snapshot(sql, context));
    }

    if (action === 'slide_add') {
      const countRows = await sql`select count(*)::int as total from public.gift_story_slides where couple_id = ${context.couple_id}::uuid`;
      if ((countRows[0]?.total || 0) >= 40) return send(res, 409, { ok: false, error: 'SLIDE_LIMIT' });

      const mediaType = MEDIA_TYPES.has(input.mediaType) ? input.mediaType : 'none';
      const mediaUrl = validateMedia(input.mediaUrl, mediaType);
      const narrationUrl = validateAudio(input.narrationUrl, 1_900_000);
      const title = clean(input.title, 100);
      const storyText = clean(input.storyText, 1200);
      const dateLabel = clean(input.dateLabel, 60);
      const narrationName = clean(input.narrationName, 120);
      if (!title && !storyText && !mediaUrl) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });

      await sql`
        insert into public.gift_story_slides
          (couple_id, created_by, position, title, story_text, date_label, media_type,
           media_url, narration_url, narration_name)
        values
          (${context.couple_id}::uuid, ${user.id}::uuid,
           (select coalesce(max(position), 0) + 1 from public.gift_story_slides where couple_id = ${context.couple_id}::uuid),
           ${title}, ${storyText}, ${dateLabel}, ${mediaType}, ${mediaUrl}, ${narrationUrl}, ${narrationName})
      `;
      return send(res, 201, await snapshot(sql, context));
    }

    if (action === 'slide_update') {
      const slideId = clean(input.slideId, 36);
      if (!validUuid(slideId)) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      const mediaType = MEDIA_TYPES.has(input.mediaType) ? input.mediaType : 'none';
      const mediaUrl = validateMedia(input.mediaUrl, mediaType);
      const narrationUrl = validateAudio(input.narrationUrl, 1_900_000);
      const title = clean(input.title, 100);
      const storyText = clean(input.storyText, 1200);
      const dateLabel = clean(input.dateLabel, 60);
      const narrationName = clean(input.narrationName, 120);

      await sql`
        update public.gift_story_slides
           set title = ${title},
               story_text = ${storyText},
               date_label = ${dateLabel},
               media_type = ${mediaType},
               media_url = ${mediaUrl},
               narration_url = ${narrationUrl},
               narration_name = ${narrationName},
               updated_at = now()
         where id = ${slideId}::uuid and couple_id = ${context.couple_id}::uuid
      `;
      return send(res, 200, await snapshot(sql, context));
    }

    if (action === 'slide_delete') {
      const slideId = clean(input.slideId, 36);
      if (!validUuid(slideId)) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });
      await sql`delete from public.gift_story_slides where id = ${slideId}::uuid and couple_id = ${context.couple_id}::uuid`;
      await compactPositions(sql, context.couple_id);
      return send(res, 200, await snapshot(sql, context));
    }

    if (action === 'slide_move') {
      const slideId = clean(input.slideId, 36);
      const direction = input.direction === 'up' ? -1 : input.direction === 'down' ? 1 : 0;
      if (!validUuid(slideId) || !direction) return send(res, 400, { ok: false, error: 'INVALID_INPUT' });

      const ordered = await sql`
        select id, position
        from public.gift_story_slides
        where couple_id = ${context.couple_id}::uuid
        order by position asc, created_at asc
      `;
      const index = ordered.findIndex((item) => item.id === slideId);
      const other = ordered[index + direction];
      const current = ordered[index];
      if (current && other) {
        await sql`
          update public.gift_story_slides
             set position = case
               when id = ${current.id}::uuid then ${other.position}
               when id = ${other.id}::uuid then ${current.position}
               else position
             end,
             updated_at = now()
           where couple_id = ${context.couple_id}::uuid
             and id in (${current.id}::uuid, ${other.id}::uuid)
        `;
      }
      await compactPositions(sql, context.couple_id);
      return send(res, 200, await snapshot(sql, context));
    }

    return send(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    const known = ['MEDIA_TOO_LARGE', 'INVALID_AUDIO', 'INVALID_MEDIA'];
    const message = String(error?.message || 'SERVER_ERROR');
    const code = known.find((item) => message.includes(item)) || 'SERVER_ERROR';
    console.error('Duke gift API error:', error);
    return send(res, code === 'SERVER_ERROR' ? 500 : 400, { ok: false, error: code });
  }
}
