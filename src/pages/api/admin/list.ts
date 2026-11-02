import type { APIRoute } from 'astro';
import { getRepo } from '../../../lib/server/db';
import { getEnv, json, reqDate, requireAdmin } from '../../../lib/server/http';

export const GET: APIRoute = async (ctx) => {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  return json({ ok: true, bookings: await repo.list(reqDate(ctx.url)) });
};