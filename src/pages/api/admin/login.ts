import type { APIRoute } from 'astro';
import { createToken, getPassword, getSecret, sessionCookie } from '../../../lib/server/auth';
import { getEnv, json } from '../../../lib/server/http';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const password = String(body.password ?? '');
  if (password !== getPassword(getEnv(ctx))) {
    return json({ ok: false, error: 'Password salah.' }, 401);
  }
  const token = await createToken(getSecret(getEnv(ctx)));
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
};