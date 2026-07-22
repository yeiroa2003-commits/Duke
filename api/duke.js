import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const PRIVATE_LINK_HASH = '9835dc4b86e69c5a0c38fa84717ee333dd74908c3e18493c485c1f776625951e';
const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const SESSION_DAYS = 30;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_MISSING');
  }
  return neon(process.env.DATABASE_URL);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function parseCookies(req) {
  const result = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function appendCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie');
  const next = current ? (Array.isArray(current) ? [...current, cookie] : [current, cookie]) : cookie;
  res.setHeader('Set-Cookie', next);
}

function setCookie(res, name, value, maxAge) {
  appendCookie(
    res,
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function clearCookie(res, name) {
  appendCookie(res, `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function hasPrivateAccess(req) {
  const token = parseCookies(req)[ACCESS_COOKIE] || '';
  return safeEqualHex(sha256(token), PRIVATE_LINK_HASH);
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

function apiError(error) {
  const text = String(error?.message || error || 'UNKNOWN_ERROR');
  const known = [
    'DATABASE_URL_MISSING', 'INVALID_EMAIL', 'PASSWORD_TOO_SHORT', 'DISPLAY_NAME_REQUIRED',
    'EMAIL_ALREADY_EXISTS', 'INVALID_CODE_OR_PIN', 'DUKE_SPACE_FULL', 'USER_ALREADY_HAS_DUKE',
    'COUPLE_NAME_REQUIRED', 'INVALID_PIN', 'NOT_A_DUKE_MEMBER', 'TWO_USERS_MAXIMUM',
    'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_INPUT'
  ];
  return known.find((code) => text.includes(code)) || 'SERVER_ERROR';
}

async function sessionUser(req, sql) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = sha256(token);
  const rows = await sql`
    select u.id, u.email, u.display_name, u.avatar, u.mood_text, u.mood_emoji,
           u.last_seen, s.id as session_id
    from public.sessions s
    join public.users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.revoked_at is null
      and s.expires_at > now()
      and u.is_active = true
    limit 1
  `;
  const user = rows[0] || null;
  if (user) {
    await sql`
      update public.sessions set last_used_at = now() where id = ${user.session_id}
    `;
  }
  return user;
}

async function createSession(req, res, sql, userId) {
  const raw = randomToken();
  const hash = sha256(raw);
  const userAgent = cleanText(req.headers['user-agent'], 500) || null;
  const forwarded = cleanText(req.headers['x-forwarded-for'], 100).split(',')[0].trim();
  const ip = forwarded || null;
  await sql`
    insert into public.sessions (user_id, token_hash, user_agent, ip_address, expires_at)
    values (${userId}, ${hash}, ${userAgent}, ${ip}, now() + interval '30 days')
  `;
  setCookie(res, SESSION_COOKIE, raw, 60 * 60 * 24 * SESSION_DAYS);
}

async function requireUser(req, res, sql) {
  const user = await sessionUser(req, sql);
  if (!user) {
    json(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    return null;
  }
  return user;
}

async function getCouple(sql, userId) {
  const rows = await sql`select * from public.get_duke_for_user(${userId})`;
  return rows[0] || null;
}

async function requireCouple(res, sql, userId) {
  const couple = await getCouple(sql, userId);
  if (!couple) {
    json(res, 409, { ok: false, error: 'NO_DUKE_SPACE' });
    return null;
  }
  return couple;
}

async function loadSnapshot(sql, user) {
  const couple = await getCouple(sql, user.id);
  if (!couple) {
    return { user, couple: null, members: [], messages: [], memories: [], dates: [], games: {}, notifications: [], stats: {} };
  }

  const [members, messages, memories, dates, gameRows, notifications, counts, activity] = await Promise.all([
    sql`select * from public.get_duke_members(${user.id}, ${couple.couple_id})`,
    sql`
      select m.id, m.sender_id, m.body, m.message_type, m.media_url,
             m.reply_to, m.reply_preview, m.created_at,
             u.display_name as sender_name, u.avatar as sender_avatar
      from public.messages m
      join public.users u on u.id = m.sender_id
      where m.couple_id = ${couple.couple_id} and m.deleted_at is null
      order by m.created_at desc
      limit 150
    `,
    sql`
      select m.*, u.display_name as author_name
      from public.memories m
      join public.users u on u.id = m.user_id
      where m.couple_id = ${couple.couple_id}
      order by coalesce(m.memory_date, m.created_at::date) desc, m.created_at desc
      limit 100
    `,
    sql`
      select * from public.special_dates
      where couple_id = ${couple.couple_id}
      order by event_date asc
      limit 100
    `,
    sql`select game_type, state, version, updated_at from public.game_states where couple_id = ${couple.couple_id}`,
    sql`
      select id, notification_type, title, body, data, created_at
      from public.notifications
      where recipient_id = ${user.id} and read_at is null
      order by created_at desc limit 30
    `,
    sql`
      select
        (select count(*)::int from public.messages where couple_id = ${couple.couple_id} and deleted_at is null) as messages,
        (select count(*)::int from public.memories where couple_id = ${couple.couple_id}) as memories,
        (select count(*)::int from public.calls where couple_id = ${couple.couple_id}) as calls
    `,
    sql`
      select activity_date
      from public.daily_activity
      where couple_id = ${couple.couple_id}
      group by activity_date
      having sum(messages_count + memories_count + games_count + calls_count) > 0
      order by activity_date desc
      limit 60
    `
  ]);

  const games = {};
  for (const row of gameRows) games[row.game_type] = { ...row.state, version: row.version, updated_at: row.updated_at };

  const activeDates = new Set(activity.map((row) => String(row.activity_date).slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeDates.has(key)) {
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  await sql`
    update public.users set last_seen = now() where id = ${user.id}
  `;
  await sql`
    insert into public.presence (user_id, couple_id, status, last_seen)
    values (${user.id}, ${couple.couple_id}, 'online', now())
    on conflict (user_id) do update set status = 'online', last_seen = now(), updated_at = now()
  `;

  return {
    user,
    couple,
    members,
    messages: messages.reverse(),
    memories,
    dates,
    games,
    notifications,
    stats: { ...(counts[0] || {}), streak }
  };
}

async function notifyPartner(sql, coupleId, senderId, type, title, body = '', data = {}) {
  const rows = await sql`
    select user_id from public.couple_members
    where couple_id = ${coupleId} and user_id <> ${senderId}
    limit 1
  `;
  if (!rows[0]) return;
  await sql`
    insert into public.notifications
      (couple_id, sender_id, recipient_id, notification_type, title, body, data)
    values
      (${coupleId}, ${senderId}, ${rows[0].user_id}, ${type}, ${title}, ${body}, ${JSON.stringify(data)}::jsonb)
  `;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const action = cleanText(req.query?.action || bodyOf(req).action, 60);

  if (action === 'unlock') {
    const key = cleanText(req.query?.key || bodyOf(req).key, 200);
    if (!safeEqualHex(sha256(key), PRIVATE_LINK_HASH)) {
      return json(res, 403, { ok: false, error: 'INVALID_PRIVATE_LINK' });
    }
    setCookie(res, ACCESS_COOKIE, key, 60 * 60 * 24 * 365);
    return json(res, 200, { ok: true });
  }

  if (action === 'gate') {
    return json(res, 200, { ok: true, unlocked: hasPrivateAccess(req) });
  }

  if (!hasPrivateAccess(req)) {
    return json(res, 403, { ok: false, error: 'PRIVATE_LINK_REQUIRED' });
  }

  let sql;
  try {
    sql = getSql();
  } catch (error) {
    return json(res, 503, { ok: false, error: apiError(error) });
  }

  try {
    if (action === 'health') {
      const rows = await sql`select now() as now, to_regclass('public.users') as users_table`;
      return json(res, 200, { ok: true, database: Boolean(rows[0]?.users_table), time: rows[0]?.now });
    }

    if (action === 'register') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      const body = bodyOf(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const displayName = cleanText(body.displayName, 40);
      const count = await sql`select count(*)::int as total from public.users where is_active = true`;
      if ((count[0]?.total || 0) >= 2) return json(res, 409, { ok: false, error: 'TWO_USERS_MAXIMUM' });
      const created = await sql`select * from public.create_duke_user(${email}, ${password}, ${displayName})`;
      const user = created[0];
      await createSession(req, res, sql, user.user_id);
      return json(res, 201, { ok: true });
    }

    if (action === 'login') {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      const body = bodyOf(req);
      const rows = await sql`select * from public.authenticate_duke_user(${normalizeEmail(body.email)}, ${String(body.password || '')})`;
      const user = rows[0];
      if (!user) return json(res, 401, { ok: false, error: 'INVALID_CREDENTIALS' });
      await createSession(req, res, sql, user.user_id);
      return json(res, 200, { ok: true });
    }

    if (action === 'logout') {
      const user = await sessionUser(req, sql);
      if (user) await sql`update public.sessions set revoked_at = now() where id = ${user.session_id}`;
      clearCookie(res, SESSION_COOKIE);
      return json(res, 200, { ok: true });
    }

    const user = await requireUser(req, res, sql);
    if (!user) return;

    if (action === 'me' || action === 'sync') {
      const snapshot = await loadSnapshot(sql, user);
      if (snapshot.notifications.length) {
        await sql`update public.notifications set read_at = now() where recipient_id = ${user.id} and read_at is null`;
      }
      return json(res, 200, { ok: true, ...snapshot });
    }

    if (action === 'create_couple') {
      const body = bodyOf(req);
      const existing = await sql`select count(*)::int as total from public.couples where is_active = true`;
      if ((existing[0]?.total || 0) > 0) return json(res, 409, { ok: false, error: 'COUPLE_ALREADY_EXISTS' });
      const name = cleanText(body.name, 60);
      const date = cleanText(body.relationshipDate, 10) || null;
      const pin = cleanText(body.pin, 8);
      const rows = await sql`select * from public.create_duke_couple(${user.id}, ${name}, ${date}, ${pin})`;
      return json(res, 201, { ok: true, couple: rows[0] });
    }

    if (action === 'join_couple') {
      const body = bodyOf(req);
      const code = cleanText(body.inviteCode, 11).toUpperCase();
      const pin = cleanText(body.pin, 8);
      const rows = await sql`select * from public.join_duke_couple(${user.id}, ${code}, ${pin})`;
      return json(res, 200, { ok: true, couple: rows[0] });
    }

    if (action === 'profile') {
      const body = bodyOf(req);
      const name = cleanText(body.displayName, 40);
      const avatar = cleanText(body.avatar, 12) || name.slice(0, 1).toUpperCase();
      if (!name) return json(res, 400, { ok: false, error: 'DISPLAY_NAME_REQUIRED' });
      await sql`update public.users set display_name = ${name}, avatar = ${avatar} where id = ${user.id}`;
      return json(res, 200, { ok: true });
    }

    if (action === 'mood') {
      const body = bodyOf(req);
      const text = cleanText(body.text, 50);
      const emoji = cleanText(body.emoji, 12);
      await sql`update public.users set mood_text = ${text || 'Feliz'}, mood_emoji = ${emoji || '😊'}, last_seen = now() where id = ${user.id}`;
      return json(res, 200, { ok: true });
    }

    const couple = await requireCouple(res, sql, user.id);
    if (!couple) return;
    const coupleId = couple.couple_id;

    if (action === 'presence') {
      const body = bodyOf(req);
      const allowed = ['online', 'away', 'busy', 'offline'];
      const status = allowed.includes(body.status) ? body.status : 'online';
      const isTyping = Boolean(body.isTyping);
      const currentView = cleanText(body.currentView, 30) || null;
      await sql`
        insert into public.presence (user_id, couple_id, status, is_typing, current_view, last_seen)
        values (${user.id}, ${coupleId}, ${status}, ${isTyping}, ${currentView}, now())
        on conflict (user_id) do update set
          status = excluded.status, is_typing = excluded.is_typing,
          current_view = excluded.current_view, last_seen = now(), updated_at = now()
      `;
      return json(res, 200, { ok: true });
    }

    if (action === 'send_message') {
      const body = bodyOf(req);
      const message = cleanText(body.body, 1200);
      const mediaUrl = cleanText(body.mediaUrl, 2_800_000) || null;
      const replyTo = cleanText(body.replyTo, 36) || null;
      const replyPreview = cleanText(body.replyPreview, 160) || null;
      if (!message && !mediaUrl) return json(res, 400, { ok: false, error: 'INVALID_INPUT' });
      const type = mediaUrl ? 'image' : 'text';
      const rows = await sql`
        insert into public.messages (couple_id, sender_id, body, message_type, media_url, reply_to, reply_preview)
        values (${coupleId}, ${user.id}, ${message}, ${type}, ${mediaUrl}, ${replyTo}, ${replyPreview})
        returning id, created_at
      `;
      await Promise.all([
        sql`select public.record_duke_activity(${user.id}, ${coupleId}, 'message')`,
        notifyPartner(sql, coupleId, user.id, 'message', `${user.display_name} te escribió`, message.slice(0, 120), { messageId: rows[0].id })
      ]);
      return json(res, 201, { ok: true, message: rows[0] });
    }

    if (action === 'add_memory') {
      const body = bodyOf(req);
      const title = cleanText(body.title, 100);
      const description = cleanText(body.description, 2000);
      const memoryDate = cleanText(body.memoryDate, 10) || null;
      const mediaUrl = cleanText(body.mediaUrl, 2_800_000) || null;
      if (!title) return json(res, 400, { ok: false, error: 'INVALID_INPUT' });
      await sql`
        insert into public.memories (couple_id, user_id, title, description, memory_date, media_url)
        values (${coupleId}, ${user.id}, ${title}, ${description}, ${memoryDate}, ${mediaUrl})
      `;
      await Promise.all([
        sql`select public.record_duke_activity(${user.id}, ${coupleId}, 'memory')`,
        notifyPartner(sql, coupleId, user.id, 'memory', 'Nuevo recuerdo en Duke', title)
      ]);
      return json(res, 201, { ok: true });
    }

    if (action === 'delete_memory') {
      const id = cleanText(bodyOf(req).id, 36);
      await sql`delete from public.memories where id = ${id} and couple_id = ${coupleId}`;
      return json(res, 200, { ok: true });
    }

    if (action === 'add_date') {
      const body = bodyOf(req);
      const title = cleanText(body.title, 80);
      const eventDate = cleanText(body.eventDate, 10);
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return json(res, 400, { ok: false, error: 'INVALID_INPUT' });
      await sql`
        insert into public.special_dates (couple_id, created_by, title, event_date, repeats_yearly)
        values (${coupleId}, ${user.id}, ${title}, ${eventDate}, ${Boolean(body.repeatsYearly)})
      `;
      return json(res, 201, { ok: true });
    }

    if (action === 'save_game') {
      const body = bodyOf(req);
      const allowed = ['tictactoe', 'questions', 'roulette', 'truth_or_dare'];
      const gameType = allowed.includes(body.gameType) ? body.gameType : null;
      if (!gameType || !body.state || typeof body.state !== 'object') return json(res, 400, { ok: false, error: 'INVALID_INPUT' });
      await sql`
        insert into public.game_states (couple_id, game_type, state, updated_by)
        values (${coupleId}, ${gameType}, ${JSON.stringify(body.state)}::jsonb, ${user.id})
        on conflict (couple_id, game_type) do update set
          state = excluded.state,
          updated_by = excluded.updated_by,
          version = public.game_states.version + 1,
          updated_at = now()
      `;
      await sql`select public.record_duke_activity(${user.id}, ${coupleId}, 'game')`;
      return json(res, 200, { ok: true });
    }

    if (action === 'missing_you') {
      await notifyPartner(sql, coupleId, user.id, 'missing_you', `${user.display_name} te extraña`, 'Entra a Duke y envíale un mensaje 💜');
      return json(res, 200, { ok: true });
    }

    if (action === 'start_call') {
      const type = bodyOf(req).type === 'audio' ? 'audio' : 'video';
      const roomName = `Duke-${String(coupleId).replaceAll('-', '')}`;
      await sql`
        insert into public.calls (couple_id, started_by, call_type, room_name, status)
        values (${coupleId}, ${user.id}, ${type}, ${roomName}, 'active')
      `;
      await Promise.all([
        sql`select public.record_duke_activity(${user.id}, ${coupleId}, 'call')`,
        notifyPartner(sql, coupleId, user.id, 'incoming_call', `${user.display_name} inició una llamada`, type === 'audio' ? 'Llamada de voz' : 'Videollamada', { roomName, type })
      ]);
      return json(res, 200, { ok: true, roomName, type });
    }

    return json(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke API error:', error);
    const code = apiError(error);
    const status = code === 'SERVER_ERROR' ? 500 : 400;
    return json(res, status, { ok: false, error: code });
  }
}
