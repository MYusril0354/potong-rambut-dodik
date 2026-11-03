// Client fetch layer — talks to the /api/* routes (Cloudflare Worker / D1).
import type { Booking, BookResult, MyBooking, QueueInfo } from './util';
import { todayWIB } from './util';

async function jfetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || 'Terjadi kesalahan (' + res.status + ')', status: res.status, data };
  }
  return data;
}

export function fetchQueue(): Promise<QueueInfo> {
  return jfetch('/api/queue');
}

export function apiBook(number: number, name: string, phone: string, turnstileToken?: string | null): Promise<BookResult> {
  return jfetch('/api/book', {
    method: 'POST',
    body: JSON.stringify({ number, name, phone, turnstile_token: turnstileToken ?? '' }),
  });
}

export function apiCancel(number: number, phone: string): Promise<{ ok: boolean; error?: string }> {
  return jfetch('/api/cancel', { method: 'POST', body: JSON.stringify({ number, phone }) });
}

export function apiLookup(phone: string): Promise<Booking | null> {
  return jfetch('/api/lookup', { method: 'POST', body: JSON.stringify({ phone }) }).then((d) => d.booking || null);
}

export function apiAdminLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  return jfetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
}
export function apiAdminLogout(): Promise<{ ok: boolean }> {
  return jfetch('/api/admin/logout', { method: 'POST' });
}
export function apiAdminList(): Promise<{ ok: boolean; error?: string; bookings?: Booking[] }> {
  return jfetch('/api/admin/list');
}
export function apiAdminNext(): Promise<{ ok: boolean; error?: string; served?: number; next?: number }> {
  return jfetch('/api/admin/next', { method: 'POST' });
}
export function apiAdminSkip(): Promise<{ ok: boolean; error?: string; skipped?: number }> {
  return jfetch('/api/admin/skip', { method: 'POST' });
}
export function apiAdminReset(): Promise<{ ok: boolean; error?: string }> {
  return jfetch('/api/admin/reset', { method: 'POST' });
}
export function apiAdminDemoFill(): Promise<{ ok: boolean; error?: string }> {
  return jfetch('/api/admin/demo', { method: 'POST' });
}

// ---------- pengaturan & FU ----------
export interface HoursEntry {
  days: string;
  dayNumbers: number[];
  open?: string;
  close?: string;
  closed: boolean;
}
export interface SettingsInfo {
  hours: HoursEntry[];
  price: number;
  priceLabel: string;
  temporarilyClosed: boolean;
  is_closed_today?: boolean;
}
export function apiGetSettings(): Promise<SettingsInfo> {
  return jfetch('/api/settings');
}
export function apiSaveSettings(patch: Partial<SettingsInfo>): Promise<{ ok: boolean; error?: string; settings: SettingsInfo }> {
  return jfetch('/api/admin/settings', { method: 'POST', body: JSON.stringify(patch) });
}
export function apiAdminNotify(id: string): Promise<{ ok: boolean; error?: string }> {
  return jfetch('/api/admin/notify', { method: 'POST', body: JSON.stringify({ id }) });
}

// ---------- per-device "my booking" marker (client only) ----------
const keyMyBooking = () => 'pd_mybooking_' + todayWIB();
export function getMyBooking(): MyBooking | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyMyBooking());
    return raw ? (JSON.parse(raw) as MyBooking) : null;
  } catch {
    return null;
  }
}
export function setMyBooking(b: MyBooking | null): void {
  if (typeof window === 'undefined') return;
  if (b) window.localStorage.setItem(keyMyBooking(), JSON.stringify(b));
  else window.localStorage.removeItem(keyMyBooking());
}