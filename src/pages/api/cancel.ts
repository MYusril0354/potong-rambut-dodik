import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const repo = await getRepo(getEnv(ctx));
  const r = await repo.cancel(reqDate(ctx.url), Number(body.number), String(body.phone ?? ''));
  if (!r.ok) return json({ ok: false, error: r.error }, 403);
  return json({ ok: true });
};