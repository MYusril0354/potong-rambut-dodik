// Server data layer — one set of business rules, two backends:
//   D1 (production, Cloudflare) and in-memory (local dev / fallback).
import type { Booking, BookingStatus, BookResult, QueueInfo, QueueState } from '../util';
import { CONFIG, isClosedDay, slotTime } from '../util';

// ---------- low-level storage interface ----------
export interface Storage {
  getBookings(date: string): Promise<Booking[]>;
  insertBooking(b: Booking): Promise<void>;
  updateBooking(id: string, patch: Partial<Booking>): Promise<void>;
  getState(date: string): Promise<QueueState | null>;
  setState(date: string, currently_serving: number): Promise<void>;
}

// ---------- business logic (shared) ----------
export interface Repo {
  getQueue(date: string): Promise<QueueInfo>;
  book(date: string, number: number, name: string, phone: string): Promise<BookResult>;
  cancel(date: string, number: number, phone: string): Promise<{ ok: boolean; error?: string }>;
  lookup(date: string, phone: string): Promise<Booking | null>;
  list(date: string): Promise<Booking[]>;
  next(date: string): Promise<{ ok: boolean; served?: number; next?: number }>;
  skip(date: string): Promise<{ ok: boolean; skipped?: number }>;
  reset(date: string): Promise<{ ok: boolean }>;
  demoFill(date: string): Promise<{ ok: boolean }>;
}

export function createRepo(storage: Storage): Repo {
  const stateOf = async (date: string): Promise<QueueState> => {
    const s = await storage.getState(date);
    if (s) return s;
    const fresh: QueueState = { date, currently_serving: 0, updated_at: Date.now() };
    await storage.setState(date, 0);
    return fresh;
  };

  const effective = (b: Booking, st: QueueState): BookingStatus => {
    if (b.status === 'cancelled') return 'cancelled';
    if (b.status === 'skipped') return 'skipped';
    if (b.status === 'done') return 'done';
    if (b.number === st.currently_serving) return 'serving';
    if (st.currently_serving > 0 && b.number < st.currently_serving) return 'done';
    return 'booked';
  };

  return {
    async getQueue(date) {
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const serving = list.find((b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked'));
      const done = list.filter((b) => effective(b, st) === 'done').map((b) => b.number);
      const skipped = list.filter((b) => b.status === 'skipped').map((b) => b.number);
      const taken = list.filter((b) => ['booked', 'serving', 'done', 'skipped'].includes(effective(b, st))).map((b) => b.number);
      const booked = list.filter((b) => effective(b, st) === 'booked' && b.number !== st.currently_serving).map((b) => b.number);
      return {
        date,
        currently_serving: st.currently_serving,
        is_closed: isClosedDay(),
        total_numbers: CONFIG.totalNumbers,
        booked,
        serving: serving ? serving.number : null,
        done,
        skipped,
        remaining: Math.max(0, CONFIG.totalNumbers - new Set(taken).size),
      };
    },

    async book(date, number, name, phoneRaw) {
      if (isClosedDay()) return { ok: false, error: 'Hari ini tutup. Booking tidak tersedia.' };
      if (!Number.isInteger(number) || number < 1 || number > CONFIG.totalNumbers) {
        return { ok: false, error: 'Nomor antrian tidak valid (1–' + CONFIG.totalNumbers + ').' };
      }
      const nameClean = name.trim();
      const phone = phoneRaw.replace(/\D/g, '');
      if (!nameClean) return { ok: false, error: 'Nama tidak boleh kosong.' };
      if (phone.length < 8) return { ok: false, error: 'Nomor HP minimal 8 digit.' };

      const list = await storage.getBookings(date);
      if (list.some((b) => b.customer_phone === phone && b.status !== 'cancelled')) {
        return { ok: false, error: 'Nomor HP ini sudah punya booking hari ini.' };
      }
      if (list.some((b) => b.number === number && b.status !== 'cancelled')) {
        return { ok: false, error: 'Nomor antrian sudah diambil.' };
      }

      const now = new Date().toISOString();
      const b: Booking = {
        id: crypto.randomUUID(),
        date,
        number,
        slot_time: slotTime(number),
        customer_name: nameClean,
        customer_phone: phone,
        status: 'booked',
        created_at: now,
        updated_at: now,
      };
      await storage.insertBooking(b);
      return { ok: true, booking: b };
    },

    async cancel(date, number, phoneRaw) {
      const phone = phoneRaw.replace(/\D/g, '');
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const b = list.find(
        (x) => x.number === number && x.customer_phone === phone && x.status === 'booked' && x.number !== st.currently_serving
      );
      if (!b) return { ok: false, error: 'Booking tidak ditemukan atau sudah tidak bisa dibatalkan.' };
      await storage.updateBooking(b.id, { status: 'cancelled', updated_at: new Date().toISOString() });
      return { ok: true };
    },

    async lookup(date, phoneRaw) {
      const phone = phoneRaw.replace(/\D/g, '');
      const list = await storage.getBookings(date);
      return list.find((b) => b.customer_phone === phone && b.status !== 'cancelled') || null;
    },

    async list(date) {
      const list = await storage.getBookings(date);
      return list.sort((a, b) => a.number - b.number);
    },

    async next(date) {
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const current = list.find((b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked'));
      if (current) {
        await storage.updateBooking(current.id, { status: 'done', updated_at: new Date().toISOString() });
      }
      const next = list
        .filter((b) => b.status === 'booked' && b.number > st.currently_serving)
        .sort((a, b) => a.number - b.number)[0];
      if (next) {
        await storage.updateBooking(next.id, { status: 'serving', updated_at: new Date().toISOString() });
      }
      await storage.setState(date, next ? next.number : st.currently_serving);
      return { ok: true, served: current ? current.number : undefined, next: next ? next.number : undefined };
    },

    async skip(date) {
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const current = list.find(
        (b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked')
      );
      if (!current) return { ok: false };
      await storage.updateBooking(current.id, { status: 'skipped', updated_at: new Date().toISOString() });
      return { ok: true, skipped: current.number };
    },

    async reset(date) {
      const list = await storage.getBookings(date);
      for (const b of list) {
        await storage.updateBooking(b.id, { status: 'cancelled', updated_at: new Date().toISOString() });
      }
      await storage.setState(date, 0);
      return { ok: true };
    },

    async demoFill(date) {
      const existing = await storage.getBookings(date);
      for (const b of existing) {
        await storage.updateBooking(b.id, { status: 'cancelled', updated_at: new Date().toISOString() });
      }
      const names = ['Bagus', 'Rizky', 'Andi', 'Fajar', 'Dimas', 'Yoga', 'Bima'];
      for (let i = 0; i < names.length; i++) {
        const number = i + 3;
        const now = new Date().toISOString();
        const b: Booking = {
          id: crypto.randomUUID(),
          date,
          number,
          slot_time: slotTime(number),
          customer_name: names[i],
          customer_phone: '0812000000' + String(i).padStart(2, '0'),
          status: i === 0 ? 'serving' : 'booked',
          created_at: now,
          updated_at: now,
        };
        await storage.insertBooking(b);
      }
      await storage.setState(date, 3);
      return { ok: true };
    },
  };
}

// ---------- in-memory backend ----------
const memBookings = new Map<string, Booking[]>();
const memState = new Map<string, QueueState>();

export const memoryStorage: Storage = {
  async getBookings(date) {
    return (memBookings.get(date) || []).map((b) => ({ ...b }));
  },
  async insertBooking(b) {
    const arr = memBookings.get(b.date) || [];
    arr.push({ ...b });
    memBookings.set(b.date, arr);
  },
  async updateBooking(id, patch) {
    for (const [date, arr] of memBookings) {
      const b = arr.find((x) => x.id === id);
      if (b) {
        Object.assign(b, patch);
        memBookings.set(date, arr);
        return;
      }
    }
  },
  async getState(date) {
    return memState.get(date) ? { ...memState.get(date)! } : null;
  },
  async setState(date, currently_serving) {
    memState.set(date, { date, currently_serving, updated_at: Date.now() });
  },
};

// ---------- D1 backend ----------
const rowToBooking = (r: any): Booking => ({
  id: r.id,
  date: r.date,
  number: r.number,
  slot_time: r.slot_time,
  customer_name: r.customer_name,
  customer_phone: r.customer_phone,
  status: r.status as BookingStatus,
  created_at: r.created_at,
  updated_at: r.updated_at,
  wa_last_notified_at: r.wa_last_notified_at ?? undefined,
});

export function d1Storage(db: any): Storage {
  return {
    async getBookings(date) {
      const res = await db.prepare('SELECT * FROM bookings WHERE date = ?').bind(date).all();
      return (res.results || []).map(rowToBooking);
    },
    async insertBooking(b) {
      await db
        .prepare(
          'INSERT INTO bookings (id, date, number, slot_time, customer_name, customer_phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(b.id, b.date, b.number, b.slot_time, b.customer_name, b.customer_phone, b.status, b.created_at, b.updated_at)
        .run();
    },
    async updateBooking(id, patch) {
      const fields: string[] = [];
      const values: any[] = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
        fields.push(`${col} = ?`);
        values.push(v);
      }
      if (!fields.length) return;
      await db.prepare(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    },
    async getState(date) {
      const r = await db.prepare('SELECT * FROM queue_state WHERE date = ?').bind(date).first();
      return r
        ? { date: r.date, currently_serving: r.currently_serving, updated_at: r.updated_at }
        : null;
    },
    async setState(date, currently_serving) {
      await db
        .prepare(
          'INSERT INTO queue_state (date, currently_serving, updated_at) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET currently_serving = ?, updated_at = ?'
        )
        .bind(date, currently_serving, new Date().toISOString(), currently_serving, new Date().toISOString())
        .run();
    },
  };
}

// ---------- factory ----------
export function getRepo(env: any): Repo {
  const db = env?.DB;
  const isProd = typeof (import.meta as any)?.env?.PROD === 'boolean' ? (import.meta as any).env.PROD : false;
  const useD1 = isProd && db && typeof db.prepare === 'function';
  return createRepo(useD1 ? d1Storage(db) : memoryStorage);
}