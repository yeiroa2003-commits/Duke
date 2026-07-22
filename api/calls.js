import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';

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

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function clean(value, max = 100) {
  return String(value ?? '').trim().slice(0, max);
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

function errorCode(error) {
  const message = String(error?.message || error || '');
  const known = [
    'DATABASE_URL_MISSING', 'UNAUTHORIZED', 'ACCESS_CODE_REQUIRED',
    'NO_DUKE_SPACE', 'PARTNER_NOT_CONNECTED', 'CALL_NOT_FOUND',
    'INVALID_SIGNAL', 'INVALID_INPUT'
  ];
  return known.find((code) => message.includes(code)) || 'SERVER_ERROR';
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

async function currentCouple(sql, userId) {
  const rows = await sql`
    select c.id,
           c.name,
           (select count(*)::int from public.couple_members m where m.couple_id = c.id) as member_count
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid
      and c.is_active = true
    limit 1
  `;
  return rows[0] || null;
}

async function ensureSignaling(sql) {
  await sql`
    create table if not exists public.call_signals (
      id bigserial primary key,
      call_id uuid not null references public.calls(id) on delete cascade,
      sender_id uuid not null references public.users(id) on delete cascade,
      signal_type varchar(20) not null check (signal_type in ('offer', 'answer', 'candidate')),
      payload jsonb not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists call_signals_call_id_idx
      on public.call_signals (call_id, id)
  `;
  await sql`delete from public.call_signals where created_at < now() - interval '1 day'`;
}

function iceServers() {
  const servers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  const turnUrl = clean(process.env.TURN_URL, 800);
  const username = clean(process.env.TURN_USERNAME, 300);
  const credential = clean(process.env.TURN_CREDENTIAL, 300);
  if (turnUrl && username && credential) {
    servers.push({
      urls: turnUrl.split(',').map((item) => item.trim()).filter(Boolean),
      username,
      credential,
    });
  }
  return servers;
}

async function activeCall(sql, coupleId) {
  await sql`
    update public.calls
    set status = 'missed', ended_at = now()
    where couple_id = ${coupleId}::uuid
      and status = 'ringing'
      and started_at < now() - interval '3 minutes'
  `;

  const rows = await sql`
    select c.id,
           c.couple_id,
           c.started_by,
           c.call_type,
           c.provider,
           c.room_name,
           c.status,
           c.started_at,
           c.answered_at,
           u.display_name as starter_name,
           u.avatar as starter_avatar
    from public.calls c
    join public.users u on u.id = c.started_by
    where c.couple_id = ${coupleId}::uuid
      and c.status in ('ringing', 'active')
      and c.started_at > now() - interval '4 hours'
    order by c.started_at desc
    limit 1
  `;
  return rows[0] || null;
}

async function assertCall(sql, callId, coupleId) {
  const rows = await sql`
    select id, couple_id, started_by, call_type, provider, room_name,
           status, started_at, answered_at
    from public.calls
    where id = ${callId}::uuid
      and couple_id = ${coupleId}::uuid
      and status in ('ringing', 'active')
    limit 1
  `;
  return rows[0] || null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const accessToken = cookies(req)[ACCESS_COOKIE] || '';
  if (!safeMatch(accessToken, AUTHORIZED_GATE_TOKEN)) {
    return json(res, 403, { ok: false, error: 'ACCESS_CODE_REQUIRED' });
  }

  if (!process.env.DATABASE_URL) {
    return json(res, 503, { ok: false, error: 'DATABASE_URL_MISSING' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    await ensureSignaling(sql);
    const user = await currentUser(req, sql);
    if (!user) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });

    const couple = await currentCouple(sql, user.id);
    if (!couple) return json(res, 409, { ok: false, error: 'NO_DUKE_SPACE' });

    const input = requestBody(req);
    const action = clean(req.query?.action || input.action, 30);

    if (action === 'status') {
      return json(res, 200, {
        ok: true,
        call: await activeCall(sql, couple.id),
        iceServers: iceServers(),
      });
    }

    if (action === 'start') {
      if (couple.member_count < 2) {
        return json(res, 409, { ok: false, error: 'PARTNER_NOT_CONNECTED' });
      }

      const type = input.type === 'audio' ? 'audio' : 'video';
      const roomName = `Duke-${String(couple.id).replaceAll('-', '')}-${crypto.randomBytes(5).toString('hex')}`;

      await sql`
        update public.calls
        set status = 'ended', ended_at = now()
        where couple_id = ${couple.id}::uuid
          and status in ('ringing', 'active')
      `;

      const rows = await sql`
        insert into public.calls
          (couple_id, started_by, call_type, provider, room_name, status)
        values
          (${couple.id}::uuid, ${user.id}::uuid, ${type}, 'webrtc', ${roomName}, 'ringing')
        returning id, couple_id, started_by, call_type, provider, room_name,
                  status, started_at, answered_at
      `;

      const call = { ...rows[0], starter_name: user.display_name, starter_avatar: user.avatar };
      return json(res, 201, { ok: true, call, iceServers: iceServers() });
    }

    const callId = clean(input.callId, 36);
    if (!callId || !/^[0-9a-f-]{36}$/i.test(callId)) {
      return json(res, 400, { ok: false, error: 'CALL_NOT_FOUND' });
    }

    const call = await assertCall(sql, callId, couple.id);
    if (!call && !['end', 'decline'].includes(action)) {
      return json(res, 404, { ok: false, error: 'CALL_NOT_FOUND' });
    }

    if (action === 'answer') {
      const rows = await sql`
        update public.calls
        set status = 'active', answered_at = coalesce(answered_at, now())
        where id = ${callId}::uuid
          and couple_id = ${couple.id}::uuid
          and status in ('ringing', 'active')
        returning id, couple_id, started_by, call_type, provider, room_name,
                  status, started_at, answered_at
      `;
      if (!rows[0]) return json(res, 404, { ok: false, error: 'CALL_NOT_FOUND' });
      return json(res, 200, { ok: true, call: rows[0], iceServers: iceServers() });
    }

    if (action === 'signal') {
      const signalType = clean(input.signalType, 20);
      if (!['offer', 'answer', 'candidate'].includes(signalType) || !input.payload || typeof input.payload !== 'object') {
        return json(res, 400, { ok: false, error: 'INVALID_SIGNAL' });
      }

      const rows = await sql`
        insert into public.call_signals (call_id, sender_id, signal_type, payload)
        values (${callId}::uuid, ${user.id}::uuid, ${signalType}, ${JSON.stringify(input.payload)}::jsonb)
        returning id
      `;
      return json(res, 201, { ok: true, signalId: rows[0].id });
    }

    if (action === 'signals') {
      const afterId = Math.max(0, Number.parseInt(String(input.afterId || '0'), 10) || 0);
      const rows = await sql`
        select id, signal_type, payload, sender_id, created_at
        from public.call_signals
        where call_id = ${callId}::uuid
          and id > ${afterId}
          and sender_id <> ${user.id}::uuid
        order by id asc
        limit 200
      `;
      return json(res, 200, { ok: true, signals: rows });
    }

    if (action === 'decline') {
      await sql`
        update public.calls
        set status = 'declined', ended_at = now()
        where id = ${callId}::uuid
          and couple_id = ${couple.id}::uuid
          and status in ('ringing', 'active')
      `;
      return json(res, 200, { ok: true });
    }

    if (action === 'end') {
      await sql`
        update public.calls
        set status = 'ended', ended_at = now()
        where id = ${callId}::uuid
          and couple_id = ${couple.id}::uuid
          and status in ('ringing', 'active')
      `;
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke calls API error:', error);
    return json(res, 500, { ok: false, error: errorCode(error) });
  }
}
