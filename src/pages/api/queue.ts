import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';

export const GET: APIRoute = async (ctx) => {
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.getQueue(reqDate(ctx.url)));
};