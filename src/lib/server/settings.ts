// Business settings: default dari site.json, override dari D1 (tabel `settings`).
// Editable lewat admin (/admin → Pengaturan) tanpa redeploy.
import site from '../../data/site.json';
import { env as cfEnv } from 'cloudflare:workers';
import { currentDayWIB } from '../util';

export interface HoursEntry {
  days: string;
  dayNumbers: number[];
  open?: string;
  close?: string;
  closed: boolean;
}

export interface Settings {
  hours: HoursEntry[];
  price: number;
  priceLabel: string;
  temporarilyClosed: boolean;
  totalNumbers: number;
  breakStart: string;
  breakEnd: string;
  startTime: string;
  slotMinutes: number;
}

function formatRupiah(n: number): string {
  return 'Rp ' + (n || 0).toLocaleString('id-ID');
}

const dbOf = (env?: any) => env?.DB || (cfEnv as any)?.DB;

async function ensureSettingsTable(db: any): Promise<void> {
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  } catch {}
}

function hmToMinutes(hm: string): number {
  const [h, m] = String(hm || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minutesToHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Slot time per nomor, melompati 1 blok istirahat.
export function computeSlotTimes(s: Settings): string[] {
  const start = hmToMinutes(s.startTime);
  const step = s.slotMinutes || 15;
  const bs = s.breakStart ? hmToMinutes(s.breakStart) : -1;
  const be = s.breakEnd ? hmToMinutes(s.breakEnd) : -1;
  const hasBreak = bs >= 0 && be > bs;
  const out: string[] = [];
  for (let n = 1; n <= s.totalNumbers; n++) {
    let m = start + (n - 1) * step;
    if (hasBreak && m >= bs) m += be - bs;
    out.push(minutesToHM(m));
  }
  return out;
}

export async function getSettings(env?: any): Promise<Settings> {
  const db = dbOf(env);
  let hours = (site as any).hours as HoursEntry[];
  let price = Number(site.price) || 0;
  let temporarilyClosed = false;
  let totalNumbers = Number(site.totalNumbers) || 40;
  let breakStart = String(site.breakStart || '');
  let breakEnd = String(site.breakEnd || '');

  if (db && typeof db.prepare === 'function') {
    await ensureSettingsTable(db);
    try {
      const res = await db.prepare('SELECT key, value FROM settings').all();
      const map: Record<string, string> = {};
      for (const r of res.results || []) map[r.key] = r.value;
      if (map.hours) {
        try {
          const h = JSON.parse(map.hours);
          if (Array.isArray(h) && h.length) hours = h;
        } catch {}
      }
      if (map.price) {
        const p = Number(map.price);
        if (Number.isFinite(p)) price = p;
      }
      temporarilyClosed = map.temporarily_closed === 'true';
      if (map.total_numbers) {
        const t = Number(map.total_numbers);
        if (Number.isFinite(t) && t > 0) totalNumbers = t;
      }
      breakStart = map.break_start || breakStart;
      breakEnd = map.break_end || breakEnd;
    } catch {
      /* fallback ke default */
    }
  }

  return {
    hours,
    price,
    priceLabel: formatRupiah(price),
    temporarilyClosed,
    totalNumbers,
    breakStart,
    breakEnd,
    startTime: String(site.startTime || '06:30'),
    slotMinutes: Number(site.slotMinutes) || 15,
  };
}

export function isClosedToday(s: Settings): boolean {
  if (s.temporarilyClosed) return true;
  const d = currentDayWIB();
  return s.hours.some((h) => h.closed && (h.dayNumbers || []).includes(d));
}

export async function saveSettings(env: any, patch: Partial<Settings>): Promise<Settings> {
  const db = dbOf(env);
  if (db && typeof db.prepare === 'function') {
    await ensureSettingsTable(db);
    const upsert = (k: string, v: string) =>
      db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
        .bind(k, v, v)
        .run();
    try {
      if (Array.isArray(patch.hours)) await upsert('hours', JSON.stringify(patch.hours));
      if (typeof patch.price === 'number') await upsert('price', String(patch.price));
      if (typeof patch.temporarilyClosed === 'boolean') await upsert('temporarily_closed', String(patch.temporarilyClosed));
      if (typeof patch.totalNumbers === 'number') await upsert('total_numbers', String(patch.totalNumbers));
      if (typeof patch.breakStart === 'string') await upsert('break_start', patch.breakStart);
      if (typeof patch.breakEnd === 'string') await upsert('break_end', patch.breakEnd);
    } catch (e) {
      console.error('saveSettings error', e);
    }
  }
  return getSettings(env);
}