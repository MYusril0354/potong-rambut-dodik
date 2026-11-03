import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';
import { verifyTurnstile } from '../../lib/server/turnstile';
import { getSettings, isClosedToday } from '../../lib/server/settings';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const env = getEnv(ctx);
  const settings = await getSettings(env);
  const closed = isClosedToday(settings);
  if (closed) return json({ ok: false, error: 'Hari ini tutup. Booking tidak tersedia.' }, 423);

  const turnstileOk = await verifyTurnstile(env, String(body.turnstile_token ?? ''));
  if (!turnstileOk) return json({ ok: false, error: 'Verifikasi captcha gagal. Silakan coba lagi.' }, 400);

  const repo = await getRepo(env);
  const r = await repo.book(
    reqDate(ctx.url),
    Number(body.number),
    String(body.name ?? ''),
    String(body.phone ?? ''),
    closed
  );
  if (!r.ok) return json({ ok: false, error: r.error }, 409);
  return json({ ok: true, booking: r.booking, number: r.booking!.number, slot_time: r.booking!.slot_time }, 201);
};