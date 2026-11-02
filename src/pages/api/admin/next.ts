import type { APIRoute } from 'astro';
import { getRepo } from '../../../lib/server/db';
import { getEnv, json, reqDate, requireAdmin } from '../../../lib/server/http';

export const POST: APIRoute = async (ctx) => {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  const r = await repo.next(reqDate(ctx.url));
  return json(r);
};