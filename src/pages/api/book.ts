import type { APIRoute } from 'astro';
import { getRepo } from '../../lib/server/db';
import { getEnv, json, reqDate } from '../../lib/server/http';
import { isClosedDay } from '../../lib/util';

export const POST: APIRoute = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  if (isClosedDay()) return json({ ok: false, error: 'Hari ini tutup. Booking tidak tersedia.' }, 423);

  const repo = getRepo(getEnv(ctx));
  const r = await repo.book(
    reqDate(ctx.url),
    Number(body.number),
    String(body.name ?? ''),
    String(body.phone ?? '')
  );
  if (!r.ok) return json({ ok: false, error: r.error }, 409);
  return json({ ok: true, booking: r.booking, number: r.booking!.number, slot_time: r.booking!.slot_time }, 201);
};