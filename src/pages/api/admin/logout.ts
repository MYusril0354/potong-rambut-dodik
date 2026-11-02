import type { APIRoute } from 'astro';
import { clearCookie } from '../../../lib/server/auth';
import { json } from '../../../lib/server/http';

export const POST: APIRoute = async () => {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
};