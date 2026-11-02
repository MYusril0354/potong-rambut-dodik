import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const repo = await getRepo(getEnv(ctx));
  const booking = await repo.lookup(reqDate(ctx.url), String(body.phone ?? ''));
  if (!booking) return json({ ok: false, error: 'Booking tidak ditemukan.' }, 404);
  return json({ ok: true, booking });
};