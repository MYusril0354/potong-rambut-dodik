import type { APIRoute } from 'astro';
import { saveSettings } from '../../../lib/server/settings';
import { getEnv, json, requireAdmin } from '../../../lib/server/http';

export const POST: APIRoute = async (ctx) => {
  const denied = await requireAdmin(ctx);
  if (denied) return denied;
  const body = await ctx.request.json().catch(() => ({}));
  const patch: any = {};
  if (Array.isArray(body.hours)) patch.hours = body.hours;
  if (typeof body.price === 'number') patch.price = body.price;
  if (typeof body.temporarilyClosed === 'boolean') patch.temporarilyClosed = body.temporarilyClosed;
  const settings = await saveSettings(getEnv(ctx), patch);
  return json({ ok: true, settings });
};