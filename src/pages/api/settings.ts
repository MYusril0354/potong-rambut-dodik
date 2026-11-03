import type { APIRoute } from 'astro';
import { getSettings, isClosedToday } from '../../lib/server/settings';
import { getEnv, json } from '../../lib/server/http';

export const GET: APIRoute = async (ctx) => {
  const settings = await getSettings(getEnv(ctx));
  return json({ ...settings, is_closed_today: isClosedToday(settings) });
};