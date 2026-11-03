import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';
import { getSettings, isClosedToday } from '../../lib/server/settings';

export const GET: APIRoute = async (ctx) => {
  const env = getEnv(ctx);
  const repo = await getRepo(env);
  const settings = await getSettings(env);
  return json(await repo.getQueue(reqDate(ctx.url), isClosedToday(settings)));
};