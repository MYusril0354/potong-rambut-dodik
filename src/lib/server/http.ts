import { todayWIB } from '../util';
import { isAuthed } from './auth';
import { env as cfEnv } from 'cloudflare:workers';

export function json(data: unknown, status = 200, init?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init || {}) },
  });
}

export function getEnv(_ctx?: any): any {
  return (cfEnv as any) ?? {};
}

export function reqDate(url: URL): string {
  return url.searchParams.get('date') || todayWIB();
}

export async function requireAdmin(ctx: any): Promise<Response | null> {
  if (!(await isAuthed(ctx.request, getEnv(ctx)))) {
    return json({ ok: false, error: 'Tidak terautorisasi.' }, 401);
  }
  return null;
}