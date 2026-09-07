import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
  return neon(process.env.DATABASE_URL);
}

function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function validState(value) {
  return Boolean(
    value && typeof value === 'object' &&
    value.settings && typeof value.settings === 'object' &&
    Array.isArray(value.clients) &&
    Array.isArray(value.employees) &&
    Array.isArray(value.washes)
  );
}

async function ensureSchema(sql) {
  await sql`
    create table if not exists public.memel_wash_state (
      id smallint primary key,
      payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      constraint memel_wash_singleton check (id = 1)
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const sql = getSql();
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        select payload, updated_at
        from public.memel_wash_state
        where id = 1
        limit 1
      `;
      const row = rows[0];
      return res.status(200).json({
        ok: true,
        state: row?.payload || null,
        updatedAt: row?.updated_at || null
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = bodyOf(req);
      if (!validState(body.state)) {
        return res.status(400).json({ ok: false, error: 'INVALID_STATE' });
      }

      const payload = JSON.stringify(body.state);
      const rows = await sql`
        insert into public.memel_wash_state (id, payload, updated_at)
        values (1, ${payload}::jsonb, now())
        on conflict (id) do update
        set payload = excluded.payload,
            updated_at = now()
        returning updated_at
      `;

      return res.status(200).json({ ok: true, updatedAt: rows[0]?.updated_at || null });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    console.error('MEMEL WASH API error:', error);
    const message = String(error?.message || error || 'SERVER_ERROR');
    const code = message.includes('DATABASE_URL_MISSING') ? 'DATABASE_URL_MISSING' : 'DATABASE_ERROR';
    return res.status(500).json({ ok: false, error: code });
  }
}
