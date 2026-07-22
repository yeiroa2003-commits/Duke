import crypto from 'node:crypto';

const ACCESS_COOKIE = 'duke_gate';
const AUTHORIZED_GATE_TOKEN = 'duke-ntDH4YaXvakCWws1aIWPKHUzonwYQKfG';

function safeMatch(received, expected) {
  const left = Buffer.from(crypto.createHash('sha256').update(String(received || '')).digest('hex'), 'hex');
  const right = Buffer.from(crypto.createHash('sha256').update(String(expected || '')).digest('hex'), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const code = String(body.code || '').trim();
  const expectedCode = String(process.env.DUKE_ACCESS_CODE || '2003').trim();

  if (!/^\d{4,8}$/.test(code) || !safeMatch(code, expectedCode)) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return res.status(403).json({ ok: false, error: 'INVALID_ACCESS_CODE' });
  }

  res.setHeader(
    'Set-Cookie',
    `${ACCESS_COOKIE}=${encodeURIComponent(AUTHORIZED_GATE_TOKEN)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
  );

  return res.status(200).json({ ok: true });
}
