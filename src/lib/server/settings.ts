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

export async function getSettings(env?: any): Promise<Settings> {
  const db = dbOf(env);
  let hours = (site as any).hours as HoursEntry[];
  let price = Number(site.price) || 0;
  let temporarilyClosed = false;

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
    } catch {
      /* fallback ke default */
    }
  }

  return { hours, price, priceLabel: formatRupiah(price), temporarilyClosed };
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
    } catch (e) {
      console.error('saveSettings error', e);
    }
  }
  return getSettings(env);
}