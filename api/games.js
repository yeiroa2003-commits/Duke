import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';
const ALLOWED_GAMES = new Set([
  'truth_dare',
  'would_you_rather',
  'love_dice',
  'memory_match',
  'compatibility',
  'couple_bingo',
  'draw_guess',
  'emoji_guess',
  'bucket_list',
  'love_coupons',
  'weekly_challenge',
  'date_planner',
]);

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

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

async function currentUser(req, sql) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const rows = await sql`
    select u.id, u.display_name
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

async function currentCouple(sql, userId) {
  const rows = await sql`
    select c.id
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid
      and c.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function ensureTable(sql) {
  await sql`
    create table if not exists public.extra_game_states (
      couple_id uuid not null references public.couples(id) on delete cascade,
      game_type varchar(40) not null,
      state jsonb not null default '{}'::jsonb,
      updated_by uuid not null references public.users(id) on delete cascade,
      version integer not null default 1,
      updated_at timestamptz not null default now(),
      primary key (couple_id, game_type)
    )
  `;
  await sql`
    create index if not exists extra_game_states_updated_idx
      on public.extra_game_states (couple_id, updated_at desc)
  `;
}

function response(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') return response(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (!safeMatch(cookies(req)[ACCESS_COOKIE] || '', AUTHORIZED_GATE_TOKEN)) {
    return response(res, 403, { ok: false, error: 'ACCESS_CODE_REQUIRED' });
  }
  if (!process.env.DATABASE_URL) return response(res, 503, { ok: false, error: 'DATABASE_URL_MISSING' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    const user = await currentUser(req, sql);
    if (!user) return response(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    const couple = await currentCouple(sql, user.id);
    if (!couple) return response(res, 409, { ok: false, error: 'NO_DUKE_SPACE' });
    await ensureTable(sql);

    const input = body(req);
    const action = String(req.query?.action || input.action || '').slice(0, 20);

    if (action === 'get') {
      const rows = await sql`
        select game_type, state, version, updated_at
        from public.extra_game_states
        where couple_id = ${couple.id}::uuid
        order by updated_at desc
      `;
      const games = {};
      for (const row of rows) games[row.game_type] = { ...row.state, version: row.version, updated_at: row.updated_at };
      return response(res, 200, { ok: true, games });
    }

    if (action === 'save') {
      const gameType = String(input.gameType || '').slice(0, 40);
      if (!ALLOWED_GAMES.has(gameType) || !input.state || typeof input.state !== 'object' || Array.isArray(input.state)) {
        return response(res, 400, { ok: false, error: 'INVALID_GAME_STATE' });
      }
      const serialized = JSON.stringify(input.state);
      if (serialized.length > 120000) return response(res, 413, { ok: false, error: 'GAME_STATE_TOO_LARGE' });

      const rows = await sql`
        insert into public.extra_game_states (couple_id, game_type, state, updated_by)
        values (${couple.id}::uuid, ${gameType}, ${serialized}::jsonb, ${user.id}::uuid)
        on conflict (couple_id, game_type) do update set
          state = excluded.state,
          updated_by = excluded.updated_by,
          version = public.extra_game_states.version + 1,
          updated_at = now()
        returning game_type, state, version, updated_at
      `;

      await sql`
        insert into public.daily_activity
          (couple_id, user_id, activity_date, games_count)
        values (${couple.id}::uuid, ${user.id}::uuid, current_date, 1)
        on conflict (couple_id, user_id, activity_date) do update set
          games_count = public.daily_activity.games_count + 1,
          updated_at = now()
      `.catch(() => {});

      return response(res, 200, { ok: true, game: rows[0] });
    }

    return response(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke games API error:', error);
    return response(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
