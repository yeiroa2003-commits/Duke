import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ACCESS_COOKIE = 'duke_gate';
const SESSION_COOKIE = 'duke_session';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';

function sqlClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
  return neon(process.env.DATABASE_URL);
}

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

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function json(res, status, payload) {
  res.status(status).json(payload);
}

function errorCode(error) {
  const message = String(error?.message || error || '');
  const known = [
    'DATABASE_URL_MISSING', 'UNAUTHORIZED', 'INVALID_PIN', 'COUPLE_NAME_REQUIRED',
    'INVALID_CODE_OR_PIN', 'DUKE_SPACE_FULL', 'USER_ALREADY_HAS_DUKE',
    'COUPLE_ALREADY_EXISTS', 'SPACE_EXISTS_JOIN_REQUIRED', 'NOT_A_DUKE_MEMBER'
  ];
  return known.find((code) => message.includes(code)) || 'SERVER_ERROR';
}

async function currentUser(req, sql) {
  const token = cookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const rows = await sql`
    select u.id, u.email, u.display_name, u.avatar
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

async function existingCouple(sql, userId) {
  const rows = await sql`
    select c.id as couple_id,
           c.name as couple_name,
           c.invite_code,
           c.relationship_date,
           (select count(*)::int from public.couple_members x where x.couple_id = c.id) as member_count
    from public.couple_members cm
    join public.couples c on c.id = cm.couple_id
    where cm.user_id = ${userId}::uuid
      and c.is_active = true
    order by c.created_at desc
    limit 1
  `;
  return rows[0] || null;
}

function inviteCode() {
  return `DUKE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  const gate = cookies(req)[ACCESS_COOKIE] || '';
  if (!safeMatch(gate, AUTHORIZED_GATE_TOKEN)) {
    return json(res, 403, { ok: false, error: 'ACCESS_CODE_REQUIRED' });
  }

  let sql;
  try {
    sql = sqlClient();
  } catch (error) {
    return json(res, 503, { ok: false, error: errorCode(error) });
  }

  try {
    const user = await currentUser(req, sql);
    if (!user) return json(res, 401, { ok: false, error: 'UNAUTHORIZED' });

    const action = text(req.query?.action || body(req).action, 30);
    const already = await existingCouple(sql, user.id);

    // La operación es idempotente: si el primer intento sí creó el espacio,
    // una repetición devuelve el mismo espacio en vez de dejar el modal abierto.
    if (already) return json(res, 200, { ok: true, couple: already, recovered: true });

    if (action === 'create') {
      const input = body(req);
      const name = text(input.name, 60);
      const pin = text(input.pin, 8);
      const relationshipDate = text(input.relationshipDate, 10) || null;

      if (name.length < 2) return json(res, 400, { ok: false, error: 'COUPLE_NAME_REQUIRED' });
      if (!/^\d{4,8}$/.test(pin)) return json(res, 400, { ok: false, error: 'INVALID_PIN' });
      if (relationshipDate && !/^\d{4}-\d{2}-\d{2}$/.test(relationshipDate)) {
        return json(res, 400, { ok: false, error: 'INVALID_DATE' });
      }

      const active = await sql`select id from public.couples where is_active = true limit 1`;
      if (active[0]) return json(res, 409, { ok: false, error: 'SPACE_EXISTS_JOIN_REQUIRED' });

      let created = null;
      for (let attempt = 0; attempt < 4 && !created; attempt += 1) {
        const code = inviteCode();
        const rows = await sql`
          with new_couple as (
            insert into public.couples
              (name, invite_code, pin_hash, relationship_date, created_by, is_active)
            select
              ${name},
              ${code},
              crypt(${pin}, gen_salt('bf', 10)),
              ${relationshipDate}::date,
              ${user.id}::uuid,
              true
            where not exists (select 1 from public.couples where is_active = true)
            on conflict (invite_code) do nothing
            returning id, name, invite_code, relationship_date
          ),
          new_member as (
            insert into public.couple_members (couple_id, user_id, role)
            select id, ${user.id}::uuid, 'owner' from new_couple
            on conflict (user_id) do nothing
            returning couple_id
          )
          select nc.id as couple_id,
                 nc.name as couple_name,
                 nc.invite_code,
                 nc.relationship_date,
                 1::int as member_count
          from new_couple nc
          join new_member nm on nm.couple_id = nc.id
        `;
        created = rows[0] || null;
      }

      if (!created) {
        const recovered = await existingCouple(sql, user.id);
        if (recovered) return json(res, 200, { ok: true, couple: recovered, recovered: true });
        return json(res, 409, { ok: false, error: 'SPACE_EXISTS_JOIN_REQUIRED' });
      }

      // Estas tablas son auxiliares. Si ya existen, quedan preparadas; si una
      // inserción secundaria falla, el espacio principal sigue siendo válido.
      await sql`
        insert into public.couple_settings (couple_id)
        values (${created.couple_id}::uuid)
        on conflict (couple_id) do nothing
      `.catch(() => {});
      await sql`
        insert into public.presence (user_id, couple_id, status, last_seen)
        values (${user.id}::uuid, ${created.couple_id}::uuid, 'online', now())
        on conflict (user_id) do update
          set couple_id = excluded.couple_id,
              status = 'online',
              last_seen = now(),
              updated_at = now()
      `.catch(() => {});

      return json(res, 201, { ok: true, couple: created });
    }

    if (action === 'join') {
      const input = body(req);
      const code = text(input.inviteCode, 11).toUpperCase();
      const pin = text(input.pin, 8);
      if (!/^DUKE-[A-Z0-9]{6}$/.test(code) || !/^\d{4,8}$/.test(pin)) {
        return json(res, 400, { ok: false, error: 'INVALID_CODE_OR_PIN' });
      }

      const rows = await sql`
        with target as (
          select c.id, c.name, c.invite_code, c.relationship_date
          from public.couples c
          where upper(c.invite_code) = ${code}
            and c.is_active = true
            and c.pin_hash = crypt(${pin}, c.pin_hash)
            and (select count(*) from public.couple_members m where m.couple_id = c.id) < 2
          limit 1
        ),
        new_member as (
          insert into public.couple_members (couple_id, user_id, role)
          select id, ${user.id}::uuid, 'partner' from target
          on conflict (user_id) do nothing
          returning couple_id
        )
        select t.id as couple_id,
               t.name as couple_name,
               t.invite_code,
               t.relationship_date,
               2::int as member_count
        from target t
        join new_member nm on nm.couple_id = t.id
      `;

      const joined = rows[0] || await existingCouple(sql, user.id);
      if (!joined) return json(res, 400, { ok: false, error: 'INVALID_CODE_OR_PIN' });

      await sql`
        insert into public.presence (user_id, couple_id, status, last_seen)
        values (${user.id}::uuid, ${joined.couple_id}::uuid, 'online', now())
        on conflict (user_id) do update
          set couple_id = excluded.couple_id,
              status = 'online',
              last_seen = now(),
              updated_at = now()
      `.catch(() => {});

      return json(res, 200, { ok: true, couple: joined });
    }

    if (action === 'status') {
      return json(res, 200, { ok: true, couple: already });
    }

    return json(res, 404, { ok: false, error: 'ACTION_NOT_FOUND' });
  } catch (error) {
    console.error('Duke space API error:', error);
    return json(res, 500, { ok: false, error: errorCode(error) });
  }
}
