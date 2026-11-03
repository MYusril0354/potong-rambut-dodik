import type { APIRoute } from 'astro';
import { createToken, getPassword, getSecret, sessionCookie } from '../../../lib/server/auth';
import { getClientIp, getEnv, json } from '../../../lib/server/http';
import { isRateLimited } from '../../../lib/server/ratelimit';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const password = String(body.password ?? '');
  if (isRateLimited(getClientIp(ctx))) {
    return json({ ok: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.' }, 429);
  }
  if (password !== getPassword(getEnv(ctx))) {
    return json({ ok: false, error: 'Password salah.' }, 401);
  }
  const token = await createToken(getSecret(getEnv(ctx)));
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
};