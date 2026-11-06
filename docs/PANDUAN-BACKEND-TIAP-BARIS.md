# Panduan Backend (Cloudflare Worker) — Penjelasan Tiap Baris

Dokumen ini menjelaskan **setiap baris** kode sisi server (backend) proyek **Pangkas Rambut Dodik**, supaya alurnya mudah dipahami dari orang awam hingga yang mau mendalami.

> Folder backend ada di `src/lib/server/` dan route API di `src/pages/api/`. Yang dimaksud "Worker" adalah kode yang berjalan di Cloudflare Workers (server), bukan di browser pengunjung.

---

## 0. Alur Request (Gambaran Besar)

```text
Permintaan masuk (mis. "GET /api/book" atau "POST /api/book")
   │
   ▼
Cloudflare Worker (edge)
   │
   ▼
Route di src/pages/api/*.ts   ← "pintu masuk", menentukan GET/POST boleh apa
   │
   ├─ requireAdmin(ctx)        ← kalau route /api/admin/*, cek cookie login dulu
   ├─ getRepo(env)             ← pilih penyimpanan: D1 (produksi) atau memory (dev)
   │      └─ (produksi) ensureSchema(db) → buat tabel kalau belum ada
   ├─ getSettings(env)         ← baca pengaturan (jam, harga, total nomor, istirahat)
   │      └─ (D1) fallback ke src/data/site.json
   ▼
repo.getQueue() / repo.book() / repo.next() ...  ← logika bisnis (di db.ts)
   │
   ▼
D1 (database SQLite) atau in-memory Map  ← tempat data sesungguhnya disimpan
   │
   ▼
jawab JSON (json(...))
```

Konsep kunci:
- **Repo** = "logika bisnis" (aturan antrian), ditulis SEKALI di `createRepo()`.
- **Storage** = "tempat simpan", punya 2 versi: `memoryStorage` (dev) dan `d1Storage` (produksi). Keduanya punya 5 method yang sama.
- `getRepo(env)` yang memutuskan pakai yang mana (berdasarkan `import.meta.env.PROD`).

---

## 1. Konfigurasi Worker

### `wrangler.toml` — deklarasi "ini Worker bernama apa, pakai database apa"

```toml
name = "pangkas-dodik"                  # nama Worker (project) di Cloudflare
compatibility_date = "2026-11-01"       # versi runtime Workers yang dipakai
compatibility_flags = ["nodejs_compat"] # izinkan sebagian API Node.js (mis. Buffer)

[[d1_databases]]                        # deklarasi binding database D1
binding = "DB"                          # nama variabel di kode: `env.DB`
database_name = "pangkas-dodik-db"      # nama database (untuk migrasi via CLI)
database_id = "9eac766f-..."            # ID unik database (wajib, dari `wrangler d1 create`)

[vars]                                  # variabel biasa (tidak rahasia)
PUBLIC_SITE_URL = "https://pangkas-dodik.example"
```

### `astro.config.mjs` — menyambungkan Astro ke Cloudflare

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';       // integrasi React (island)
import cloudflare from '@astrojs/cloudflare'; // adapter: build jadi Worker

export default defineConfig({
  site: 'https://pangkas-dodik.example',   // domain untuk SEO/canonical
  output: 'server',                        // mode server (bisa prerender + on-demand)
  integrations: [react()],
  adapter: cloudflare(),                   // hasil build = Worker (dist/server + dist/client)
});
```

---

## 2. `src/lib/server/http.ts` — Helper kecil (respons JSON, ambil env, dst.)

```ts
import { todayWIB } from '../util';            // helper tanggal WIB
import { isAuthed } from './auth';             // cek login admin
import { env as cfEnv } from 'cloudflare:workers'; // akses binding/secret (DB, ADMIN_SECRET, dst.)

export function json(data, status = 200, init?) {
  return new Response(JSON.stringify(data), {   // bungkus object jadi string JSON
    status,                                     // HTTP status (200/400/401/...)
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init || {}) },
  });
}
// → setiap response API memakai json(...) ini supaya konsisten.

export function getEnv(_ctx?) {
  return (cfEnv) ?? {};                         // kembalikan binding Cloudflare (DB, secret)
}

export function reqDate(url) {
  return url.searchParams.get('date') || todayWIB(); // tanggal dari ?date=... atau hari ini (WIB)
}

export function getClientIp(ctx) {
  return ctx?.clientAddress                       // IP asli dari Cloudflare
    || ctx?.request?.headers?.get('cf-connecting-ip')
    || ctx?.request?.headers?.get('x-forwarded-for')
    || 'unknown';
}                                                 // untuk rate-limit login

export async function requireAdmin(ctx) {
  if (!(await isAuthed(ctx.request, getEnv(ctx)))) {
    return json({ ok: false, error: 'Tidak terautorisasi.' }, 401);
  }
  return null;                                    // null = lolos (bukan respons error)
}
```

---

## 3. `src/lib/server/auth.ts` — Login admin (password + cookie HMAC)

```ts
const DEFAULT_SECRET = 'dev-admin-secret-change-me'; // fallback secret saat DEV
const DEFAULT_PASSWORD = 'dodik';                   // fallback password saat DEV
const SESSION_MAX_AGE = 8 * 60 * 60;                // sesi login berlaku 8 jam (detik)
const COOKIE_NAME = 'admin_session';                // nama cookie di browser

export function getSecret(env) {
  return env?.ADMIN_SECRET || DEFAULT_SECRET;       // secret asli dari Worker secret, atau fallback dev
}
export function getPassword(env) {
  return env?.ADMIN_PASSWORD || DEFAULT_PASSWORD;   // password admin (produksi = secret, dev = "dodik")
}

// ===== base64url (untuk token cookie yang aman di URL) =====
function b64url(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf); // pastikan jadi byte array
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); // byte → string biner
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // base64 → ganti karakter agar URL-safe
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/'); // balikkan ke base64 biasa
  const bin = atob(b64);                                 // base64 → string biner
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); // string → byte array
  return new TextDecoder().decode(bytes);                 // byte → teks
}

// ===== HMAC-SHA256 (tanda tangan) =====
async function hmac(text, secret) {
  const enc = new TextEncoder();                       // encoder teks → byte
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // → buat "kunci" dari secret untuk algoritma HMAC-SHA256 (hanya untuk menandatangani)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text)); // buat tanda tangan dari `text`
  return b64url(sig);                                   // tanda tangan → base64url
}

// ===== buat token login =====
export async function createToken(secret) {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1000 }); // isi token: masa kadaluarsa (8 jam dari sekarang)
  const payloadB64 = b64url(new TextEncoder().encode(payload));                  // payload → base64url
  const sig = await hmac(payloadB64, secret);                                    // tanda tangan (agar tak bisa dipalsukan)
  return payloadB64 + '.' + sig;                                                 // token = payload.tandatangan
}

// ===== verifikasi token =====
export async function verifyToken(token, secret) {
  try {
    const [payloadB64, sig] = token.split('.');        // pecah jadi 2 bagian
    if (!payloadB64 || !sig) return false;             // format salah → tolak
    const expected = await hmac(payloadB64, secret);   // hitung ulang tanda tangan
    if (expected !== sig) return false;                // tanda tangan berbeda → tolak (dipalsukan)
    const payload = JSON.parse(b64urlDecode(payloadB64)); // baca isi
    return typeof payload.exp === 'number' && payload.exp > Date.now(); // valid hanya jika belum kedaluwarsa
  } catch {
    return false;                                      // error apa pun → tolak
  }
}

// ===== baca cookie dari header =====
export function parseCookies(header) {
  const out = {};
  if (!header) return out;                              // tidak ada cookie → kosong
  for (const part of header.split(';')) {               // pisah per ";"
    const idx = part.indexOf('=');                      // cari "="
    if (idx === -1) continue;                           // tidak ada "=" → lewati
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }                                                     // simpan nama → nilai
  return out;
}

// ===== penentu "apakah sudah login" =====
export async function isAuthed(request, env) {
  const cookies = parseCookies(request.headers.get('cookie')); // ambil cookie dari request
  const token = cookies[COOKIE_NAME];                          // ambil token login
  if (!token) return false;                                    // tidak ada token → belum login
  return verifyToken(token, getSecret(env));                    // verifikasi token
}

// ===== helper membuat cookie =====
export function sessionCookie(token, maxAge = SESSION_MAX_AGE) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
  // HttpOnly = JS browser tak bisa baca (anti XSS); Secure = hanya HTTPS; SameSite=Strict = anti CSRF
}
export function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`; // Max-Age 0 = hapus
}
```

---

## 4. `src/lib/server/ratelimit.ts` — Batasi percobaan login

```ts
const buckets = new Map<string, number[]>(); // map: IP → daftar waktu percobaan (timestamp)

export function isRateLimited(key, max = 5, windowMs = 60000) {
  const now = Date.now();                             // waktu sekarang (ms)
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  // → ambil percobaan yang masih dalam 60 detik terakhir
  if (arr.length >= max) {                            // sudah 5 kali?
    buckets.set(key, arr);                            // simpan (tanpa tambah)
    return true;                                      // → diblokir
  }
  arr.push(now);                                      // catat percobaan baru
  buckets.set(key, arr);
  return false;                                       // → masih boleh
}
```

---

## 5. `src/lib/server/turnstile.ts` — Verifikasi CAPTCHA (anti robot)

```ts
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'; // endpoint verifikasi Turnstile

export async function verifyTurnstile(env, token) {
  const secret = env?.TURNSTILE_SECRET_KEY; // secret key Turnstile (jika belum di-set → kosong)
  if (!secret) return true;                 // captcha belum dikonfigurasi → lewati (anggap lolos)
  if (!token) return false;                 // ada secret tapi token kosong → tolak
  try {
    const form = new FormData();            // kirim sebagai form (standar Turnstile)
    form.append('secret', secret);          // secret key
    form.append('response', token);         // token dari browser pengunjung
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form }); // tanya ke Cloudflare
    const data = await res.json();          // jawaban { success: true/false }
    return data?.success === true;          // hanya lolos jika Cloudflare bilang benar
  } catch {
    return false;                           // gagal → tolak (aman)
  }
}
```

---

## 6. `src/lib/server/settings.ts` — Pengaturan bisnis (harga, jam, total nomor, istirahat)

```ts
import site from '../../data/site.json';         // data default dari file JSON
import { env as cfEnv } from 'cloudflare:workers'; // binding Cloudflare
import { currentDayWIB } from '../util';         // helper hari (WIB)

export interface HoursEntry { days; dayNumbers; open?; close?; closed; } // bentuk 1 baris jam
export interface Settings {
  hours; price; priceLabel; temporarilyClosed;   // jam, harga, status tutup darurat
  totalNumbers; breakStart; breakEnd;             // total nomor + jam istirahat
  startTime; slotMinutes;                         // jam mulai + durasi per slot
}

function formatRupiah(n) {
  return 'Rp ' + (n || 0).toLocaleString('id-ID'); // 13000 → "Rp 13.000"
}

const dbOf = (env) => env?.DB || (cfEnv).DB;       // ambil binding DB (dari param atau global)

async function ensureSettingsTable(db) {
  try { await db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run(); }
  catch {}
  // → pastikan tabel `settings` ada (idempoten). Tabel ini berbentuk key-value.
}

// ===== konversi waktu =====
function hmToMinutes(hm) { const [h, m] = String(hm || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); } // "12:30" → 750 menit
function minutesToHM(mins) { const h = Math.floor(mins / 60); const m = mins % 60; return pad(h) + ':' + pad(m); } // 750 → "12:30"

// ===== hitung jam semua slot (melompati istirahat) =====
export function computeSlotTimes(s) {
  const start = hmToMinutes(s.startTime);   // jam mulai (06:30 = 390)
  const step = s.slotMinutes || 15;         // jarak antar slot (15 menit)
  const bs = s.breakStart ? hmToMinutes(s.breakStart) : -1; // mulai istirahat (menit) / -1 bila kosong
  const be = s.breakEnd ? hmToMinutes(s.breakEnd) : -1;     // selesai istirahat
  const hasBreak = bs >= 0 && be > bs;      // ada istirahat valid?
  const out = [];
  for (let n = 1; n <= s.totalNumbers; n++) {
    let m = start + (n - 1) * step;          // jam dasar tanpa istirahat
    if (hasBreak && m >= bs) m += be - bs;   // jika slot jatuh pada/lewat awal istirahat → geser sebesar durasi istirahat
    out.push(minutesToHM(m));                // simpan "HH:MM"
  }
  return out;                                // mis. ["06:30","06:45",...,"11:45","12:30",...]
}

// ===== baca setting (D1 dulu, fallback site.json) =====
export async function getSettings(env) {
  const db = dbOf(env);
  let hours = (site).hours;                  // default dari site.json
  let price = Number(site.price) || 0;
  let temporarilyClosed = false;
  let totalNumbers = Number(site.totalNumbers) || 40;
  let breakStart = String(site.breakStart || '');
  let breakEnd = String(site.breakEnd || '');

  if (db && typeof db.prepare === 'function') {   // ada D1?
    await ensureSettingsTable(db);                // buat tabel bila belum ada
    try {
      const res = await db.prepare('SELECT key, value FROM settings').all(); // ambil semua setting
      const map = {};
      for (const r of res.results || []) map[r.key] = r.value; // ubah jadi {key: value}
      if (map.hours) { try { const h = JSON.parse(map.hours); if (Array.isArray(h) && h.length) hours = h; } catch {} }
      if (map.price) { const p = Number(map.price); if (Number.isFinite(p)) price = p; }
      temporarilyClosed = map.temporarily_closed === 'true';
      if (map.total_numbers) { const t = Number(map.total_numbers); if (Number.isFinite(t) && t > 0) totalNumbers = t; }
      breakStart = map.break_start || breakStart;
      breakEnd = map.break_end || breakEnd;
    } catch { /* pakai default */ }
  }

  return { hours, price, priceLabel: formatRupiah(price), temporarilyClosed, totalNumbers, breakStart, breakEnd, startTime: site.startTime || '06:30', slotMinutes: Number(site.slotMinutes) || 15 };
}

// ===== "hari ini tutup?" =====
export function isClosedToday(s) {
  if (s.temporarilyClosed) return true;      // tombol tutup darurat aktif → tutup
  const d = currentDayWIB();                 // hari ini (0=Minggu .. 6=Sabtu)
  return s.hours.some((h) => h.closed && (h.dayNumbers || []).includes(d)); // ada hari ini yang "closed"?
}

// ===== simpan setting ke D1 =====
export async function saveSettings(env, patch) {
  const db = dbOf(env);
  if (db && typeof db.prepare === 'function') {
    await ensureSettingsTable(db);
    const upsert = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').bind(k, v, v).run();
    // → INSERT; kalau key sudah ada → UPDATE (single source)
    try {
      if (Array.isArray(patch.hours)) await upsert('hours', JSON.stringify(patch.hours));
      if (typeof patch.price === 'number') await upsert('price', String(patch.price));
      if (typeof patch.temporarilyClosed === 'boolean') await upsert('temporarily_closed', String(patch.temporarilyClosed));
      if (typeof patch.totalNumbers === 'number') await upsert('total_numbers', String(patch.totalNumbers));
      if (typeof patch.breakStart === 'string') await upsert('break_start', patch.breakStart);
      if (typeof patch.breakEnd === 'string') await upsert('break_end', patch.breakEnd);
    } catch (e) { console.error('saveSettings error', e); }
  }
  return getSettings(env);                   // baca ulang (agar respons memuat nilai terbaru)
}
```

---

## 7. `src/lib/server/db.ts` — INTI logika bisnis + penyimpanan

File ini paling penting. Dibagi 5 bagian: (1) tipe, (2) logika bisnis `createRepo`, (3) penyimpanan memory, (4) penyimpanan D1, (5) auto-buat tabel + pabrik `getRepo`.

### 7.1 Tipe dasar

```ts
import type { Booking, BookingStatus, BookResult, QueueInfo, QueueState } from '../util';
import { CONFIG, slotTime } from '../util'; // CONFIG = default (40 nomor, 15 menit); slotTime = hitung jam slot sederhana

export interface Storage {                    // 5 method yang WAJIB dimiliki setiap penyimpanan
  getBookings(date): Promise<Booking[]>;       // ambil semua booking tanggal tsb
  insertBooking(b): Promise<void>;             // tambah booking
  updateBooking(id, patch): Promise<void>;     // ubah sebagian kolom booking
  getState(date): Promise<QueueState | null>;  // ambil "nomor sedang dilayani"
  setState(date, currently_serving): Promise<void>; // set "nomor sedang dilayani"
}

export interface Repo {                        // method logika bisnis yang dipakai route
  getQueue(date, closed?, totalNumbers?): Promise<QueueInfo>;
  book(date, number, name, phone, closed?, totalNumbers?, slot_time?): Promise<BookResult>;
  cancel(...); lookup(...); list(...); next(...); skip(...); reset(...); demoFill(...); notify(...);
}
```

### 7.2 `createRepo(storage)` — LOGIKA BISNIS (ditulis sekali, dipakai dua backend)

```ts
export function createRepo(storage) {
  // helper: ambil/membuat "state" (nomor sedang dilayani) untuk tanggal tsb
  const stateOf = async (date) => {
    const s = await storage.getState(date);   // coba ambil
    if (s) return s;                          // sudah ada → pakai
    const fresh = { date, currently_serving: 0, updated_at: Date.now() }; // belum ada → mulai dari 0
    await storage.setState(date, 0);
    return fresh;
  };

  // helper: tentukan status "efektif" sebuah booking berdasarkan state antrian
  const effective = (b, st) => {
    if (b.status === 'cancelled') return 'cancelled';  // dibatalkan
    if (b.status === 'skipped') return 'skipped';      // dilewati
    if (b.status === 'done') return 'done';            // selesai
    if (b.number === st.currently_serving) return 'serving'; // sedang dilayani sekarang
    if (st.currently_serving > 0 && b.number < st.currently_serving) return 'done'; // sudah lewat → dianggap selesai
    return 'booked';                                    // sisanya = antri
  };

  return {
    // ---- lihat papan antrian (publik) ----
    async getQueue(date, closed = false, totalNumbers = CONFIG.totalNumbers) {
      const st = await stateOf(date);                 // nomor sedang dilayani
      const list = await storage.getBookings(date);   // semua booking hari ini
      const serving = list.find((b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked')); // siapa yang sedang dilayani
      const done = list.filter((b) => effective(b, st) === 'done').map((b) => b.number);      // nomor selesai
      const skipped = list.filter((b) => b.status === 'skipped').map((b) => b.number);        // nomor dilewati
      const taken = list.filter((b) => ['booked','serving','done','skipped'].includes(effective(b, st))).map((b) => b.number); // semua nomor terpakai
      const booked = list.filter((b) => effective(b, st) === 'booked' && b.number !== st.currently_serving).map((b) => b.number); // nomor masih antri
      return {
        date,
        currently_serving: st.currently_serving,      // angka nomor yang sedang dilayani
        is_closed: closed,                            // apakah toko tutup (dari route/settings)
        total_numbers: totalNumbers,                  // total nomor per hari
        booked, serving: serving ? serving.number : null, done, skipped,
        remaining: Math.max(0, totalNumbers - new Set(taken).size), // sisa nomor bebas
      };
    },

    // ---- buat booking baru ----
    async book(date, number, name, phoneRaw, closed = false, totalNumbers = CONFIG.totalNumbers, slot_time = slotTime(number)) {
      if (closed) return { ok: false, error: 'Hari ini tutup. Booking tidak tersedia.' }; // tutup → tolak
      if (!Number.isInteger(number) || number < 1 || number > totalNumbers) {             // nomor di luar 1..total?
        return { ok: false, error: 'Nomor antrian tidak valid (1–' + totalNumbers + ').' };
      }
      const nameClean = name.trim();                     // buang spasi awal/akhir nama
      const phone = phoneRaw.replace(/\D/g, '');         // buang semua selain ANGKA dari HP
      if (!nameClean) return { ok: false, error: 'Nama tidak boleh kosong.' };
      if (phone.length < 9) return { ok: false, error: 'Nomor HP tidak valid... (minimal 9 digit).' };

      const list = await storage.getBookings(date);      // cek bentrok
      if (list.some((b) => b.customer_phone === phone && b.status !== 'cancelled')) {
        return { ok: false, error: 'Nomor HP ini sudah punya booking hari ini.' }; // 1 HP = 1 booking/hari
      }
      if (list.some((b) => b.number === number && b.status !== 'cancelled')) {
        return { ok: false, error: 'Nomor antrian sudah diambil.' };               // nomor sudah kepakai
      }

      const now = new Date().toISOString();              // waktu sekarang (UTC)
      const b = { id: crypto.randomUUID(), date, number, slot_time, customer_name: nameClean, customer_phone: phone, status: 'booked', created_at: now, updated_at: now };
      await storage.insertBooking(b);                    // simpan
      return { ok: true, booking: b };
    },

    // ---- batalkan booking (oleh pelanggan) ----
    async cancel(date, number, phoneRaw) {
      const phone = phoneRaw.replace(/\D/g, '');
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const b = list.find((x) => x.number === number && x.customer_phone === phone && x.status === 'booked' && x.number !== st.currently_serving);
      // → hanya bisa batal jika: nomor & HP cocok, status masih "booked", dan bukan yang sedang dilayani
      if (!b) return { ok: false, error: 'Booking tidak ditemukan atau sudah tidak bisa dibatalkan.' };
      await storage.updateBooking(b.id, { status: 'cancelled', updated_at: new Date().toISOString() });
      return { ok: true };
    },

    // ---- cek booking via HP (halaman status) ----
    async lookup(date, phoneRaw) {
      const phone = phoneRaw.replace(/\D/g, '');
      const list = await storage.getBookings(date);
      return list.find((b) => b.customer_phone === phone && b.status !== 'cancelled') || null;
    },

    // ---- daftar booking (untuk admin) ----
    async list(date) {
      const list = await storage.getBookings(date);
      return list.sort((a, b) => a.number - b.number); // urutkan dari nomor kecil
    },

    // ---- tandai sudah di-FU (WhatsApp) ----
    async notify(id) {
      await storage.updateBooking(id, { wa_last_notified_at: new Date().toISOString() }); // catat jam FU
      return { ok: true };
    },

    // ---- PANGGIL BERIKUTNYA (inti) ----
    async next(date) {
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const current = list.find((b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked')); // yang sedang dilayani
      if (current) await storage.updateBooking(current.id, { status: 'done', updated_at: ... }); // tandai selesai
      const next = list.filter((b) => b.status === 'booked' && b.number > st.currently_serving)
                        .sort((a, b) => a.number - b.number)[0]; // nomor berikutnya (terkecil yang masih antri)
      if (next) await storage.updateBooking(next.id, { status: 'serving', updated_at: ... }); // tandai sedang dilayani
      await storage.setState(date, next ? next.number : st.currently_serving); // update "sedang dilayani"
      return { ok: true, served: current ? current.number : undefined, next: next ? next.number : undefined };
    },

    // ---- LEWATI nomor sekarang ----
    async skip(date) {
      const st = await stateOf(date);
      const list = await storage.getBookings(date);
      const current = list.find((b) => b.number === st.currently_serving && (b.status === 'serving' || b.status === 'booked'));
      if (!current) return { ok: false };
      await storage.updateBooking(current.id, { status: 'skipped', updated_at: ... }); // tandai dilewati
      return { ok: true, skipped: current.number };
    },

    // ---- RESET hari ini ----
    async reset(date) {
      const list = await storage.getBookings(date);
      for (const b of list) await storage.updateBooking(b.id, { status: 'cancelled', updated_at: ... }); // batalkan semua
      await storage.setState(date, 0); // nomor dilayani kembali 0
      return { ok: true };
    },

    // ---- isi data DEMO (untuk pitch/tes) ----
    async demoFill(date) {
      const existing = await storage.getBookings(date);
      for (const b of existing) await storage.updateBooking(b.id, { status: 'cancelled', ... }); // bersihkan dulu
      const names = ['Bagus','Rizky','Andi','Fajar','Dimas','Yoga','Bima'];
      for (let i = 0; i < names.length; i++) {
        const number = i + 3;                                             // nomor 3..9
        const b = { id: crypto.randomUUID(), date, number, slot_time: slotTime(number), customer_name: names[i],
                    customer_phone: '0812000000' + String(i).padStart(2, '0'),
                    status: i === 0 ? 'serving' : 'booked',               // yang pertama jadi "sedang dilayani"
                    created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        await storage.insertBooking(b);
      }
      await storage.setState(date, 3); // nomor #3 sedang dilayani
      return { ok: true };
    },
  };
}
```

### 7.3 Penyimpanan IN-MEMORY (dev lokal / fallback)

```ts
const memBookings = new Map(); // Map<tanggal, Booking[]>
const memState = new Map();    // Map<tanggal, QueueState>

export const memoryStorage = {
  async getBookings(date) { return (memBookings.get(date) || []).map((b) => ({ ...b })); }, // salin agar aman
  async insertBooking(b) { const arr = memBookings.get(b.date) || []; arr.push({ ...b }); memBookings.set(b.date, arr); },
  async updateBooking(id, patch) {
    for (const [date, arr] of memBookings) { const b = arr.find((x) => x.id === id); if (b) { Object.assign(b, patch); memBookings.set(date, arr); return; } }
  },
  async getState(date) { return memState.get(date) ? { ...memState.get(date) } : null; },
  async setState(date, currently_serving) { memState.set(date, { date, currently_serving, updated_at: Date.now() }); },
};
// Catatan: memory ini hilang tiap dev-server di-restart — hanya untuk pengembangan.
```

### 7.4 Penyimpanan D1 (produksi)

```ts
const rowToBooking = (r) => ({ id: r.id, date: r.date, number: r.number, slot_time: r.slot_time,
  customer_name: r.customer_name, customer_phone: r.customer_phone, status: r.status,
  created_at: r.created_at, updated_at: r.updated_at, wa_last_notified_at: r.wa_last_notified_at ?? undefined });
// → ubah baris D1 (snake_case) menjadi object booking (camelCase)

export function d1Storage(db) {
  return {
    async getBookings(date) {
      const res = await db.prepare('SELECT * FROM bookings WHERE date = ?').bind(date).all(); // SQL aman (prepared statement, ? = Hindari SQL injection)
      return (res.results || []).map(rowToBooking);
    },
    async insertBooking(b) {
      await db.prepare('INSERT INTO bookings (id, date, number, slot_time, customer_name, customer_phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(b.id, b.date, b.number, b.slot_time, b.customer_name, b.customer_phone, b.status, b.created_at, b.updated_at).run();
    },
    async updateBooking(id, patch) {
      const fields = []; const values = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()); // camelCase → snake_case (slot_time → slot_time)
        fields.push(`${col} = ?`); values.push(v);
      }
      if (!fields.length) return; // tidak ada yang diubah → lewati
      await db.prepare(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`).bind(...values, id).run();
    },
    async getState(date) {
      const r = await db.prepare('SELECT * FROM queue_state WHERE date = ?').bind(date).first();
      return r ? { date: r.date, currently_serving: r.currently_serving, updated_at: r.updated_at } : null;
    },
    async setState(date, currently_serving) {
      await db.prepare('INSERT INTO queue_state (date, currently_serving, updated_at) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET currently_serving = ?, updated_at = ?')
        .bind(date, currently_serving, new Date().toISOString(), currently_serving, new Date().toISOString()).run();
      // → "UPSERT": jika tanggal sudah ada → update, kalau belum → insert (single source per tanggal)
    },
  };
}
```

### 7.5 Auto-buat tabel + pabrik `getRepo`

```ts
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, date TEXT NOT NULL, number INTEGER NOT NULL,
    slot_time TEXT NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    wa_last_notified_at TEXT, UNIQUE(date, number))`,           // UNIQUE(date,number) = cegah nomor dobel
  `CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings(date, status)`,   // percepat query
  `CREATE INDEX IF NOT EXISTS idx_bookings_phone_date ON bookings(customer_phone, date)`,
  `CREATE TABLE IF NOT EXISTS queue_state (date TEXT PRIMARY KEY, currently_serving INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`, // tabel pengaturan key-value
];
// Semua pakai "IF NOT EXISTS" → aman dijalankan berulang kali.

const schemaPromises = new WeakMap(); // cache: 1 database hanya di-migrasi 1 kali per proses

function ensureSchema(db) {
  let p = schemaPromises.get(db);
  if (!p) {
    p = (async () => { for (const sql of SCHEMA_STATEMENTS) await db.prepare(sql).run(); })()
        .catch((e) => { schemaPromises.delete(db); throw e; }); // gagal → hapus cache agar bisa coba lagi
    schemaPromises.set(db, p);
  }
  return p;
}

export async function getRepo(env) {
  const db = env?.DB;
  const isProd = (import.meta).env?.PROD === true;       // "sedang build produksi?" (true di Worker, false di dev)
  const useD1 = isProd && db && typeof db.prepare === 'function'; // pakai D1 hanya di produksi
  if (useD1) {
    await ensureSchema(db);         // pastikan tabel ada dulu
    return createRepo(d1Storage(db)); // bungkus D1 sebagai storage
  }
  return createRepo(memoryStorage); // dev → memory
}
```

---

## 8. Route API (`src/pages/api/`)

Setiap file = 1 endpoint. `APIRoute` adalah tipe dari Astro; `GET`/`POST` adalah fungsi yang diekspor.

### `api/queue.ts` — lihat antrian (publik)
```ts
export const GET = async (ctx) => {
  const env = getEnv(ctx);                   // ambil binding
  const repo = await getRepo(env);           // pilih penyimpanan (lazy migrasi di produksi)
  const settings = await getSettings(env);   // baca pengaturan
  const queue = await repo.getQueue(reqDate(ctx.url), isClosedToday(settings), settings.totalNumbers);
  return json({ ...queue, slot_times: computeSlotTimes(settings) }); // tambah daftar jam tiap slot
};
```

### `api/book.ts` — buat booking (publik)
```ts
export const POST = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({})); // baca body JSON (aman bila kosong)
  const env = getEnv(ctx);
  const settings = await getSettings(env);
  const closed = isClosedToday(settings);
  if (closed) return json({ ok: false, error: 'Hari ini tutup...' }, 423); // tolak kalau tutup

  const turnstileOk = await verifyTurnstile(env, String(body.turnstile_token ?? '')); // verifikasi captcha
  if (!turnstileOk) return json({ ok: false, error: 'Verifikasi captcha gagal...' }, 400);

  const number = Number(body.number);
  const slotTimes = computeSlotTimes(settings);               // daftar jam slot
  const slot_time = number >= 1 && number <= slotTimes.length ? slotTimes[number - 1] : ''; // jam slot sesuai nomor (break-aware)

  const repo = await getRepo(env);
  const r = await repo.book(reqDate(ctx.url), number, String(body.name ?? ''), String(body.phone ?? ''), closed, settings.totalNumbers, slot_time);
  if (!r.ok) return json({ ok: false, error: r.error }, 409); // 409 = konflik (nomor/HP sudah dipakai)
  return json({ ok: true, booking: r.booking, number: r.booking.number, slot_time: r.booking.slot_time }, 201); // 201 = berhasil dibuat
};
```

### `api/cancel.ts` — batalkan booking
```ts
export const POST = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const repo = await getRepo(getEnv(ctx));
  const r = await repo.cancel(reqDate(ctx.url), Number(body.number), String(body.phone ?? ''));
  if (!r.ok) return json({ ok: false, error: r.error }, 403); // 403 = tidak boleh
  return json({ ok: true });
};
```

### `api/lookup.ts` — cek booking via HP
```ts
export const POST = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const repo = await getRepo(getEnv(ctx));
  const booking = await repo.lookup(reqDate(ctx.url), String(body.phone ?? ''));
  if (!booking) return json({ ok: false, error: 'Booking tidak ditemukan.' }, 404);
  return json({ ok: true, booking });
};
```

### `api/settings.ts` — baca pengaturan (publik)
```ts
export const GET = async (ctx) => {
  const settings = await getSettings(getEnv(ctx));
  return json({ ...settings, is_closed_today: isClosedToday(settings) });
};
```

### `api/admin/login.ts` — login admin (rate-limit 5x/menit)
```ts
export const POST = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({}));
  const password = String(body.password ?? '');
  if (isRateLimited(getClientIp(ctx))) return json({ ok: false, error: 'Terlalu banyak percobaan...' }, 429); // batasi percobaan
  if (password !== getPassword(getEnv(ctx))) return json({ ok: false, error: 'Password salah.' }, 401);
  const token = await createToken(getSecret(getEnv(ctx)));   // buat token login
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) }); // simpan token ke cookie browser
};
```

### `api/admin/logout.ts` — keluar
```ts
export const POST = async () => json({ ok: true }, 200, { 'Set-Cookie': clearCookie() }); // hapus cookie login
```

### `api/admin/list.ts` — daftar booking (admin saja)
```ts
export const GET = async (ctx) => {
  const denied = await requireAdmin(ctx);   // cek login
  if (denied) return denied;                // belum login → 401
  const repo = await getRepo(getEnv(ctx));
  return json({ ok: true, bookings: await repo.list(reqDate(ctx.url)) });
};
```

### `api/admin/next.ts` — panggil berikutnya (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.next(reqDate(ctx.url)));
};
```

### `api/admin/skip.ts` — lewati (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.skip(reqDate(ctx.url)), r.ok ? 200 : 409);
};
```

### `api/admin/reset.ts` — reset hari (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.reset(reqDate(ctx.url)));
};
```

### `api/admin/demo.ts` — isi data demo (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.demoFill(reqDate(ctx.url)));
};
```

### `api/admin/notify.ts` — tandai sudah di-FU (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const body = await ctx.request.json().catch(() => ({}));
  const repo = await getRepo(getEnv(ctx));
  return json(await repo.notify(String(body.id ?? '')));
};
```

### `api/admin/settings.ts` — simpan pengaturan (admin)
```ts
export const POST = async (ctx) => {
  const denied = await requireAdmin(ctx); if (denied) return denied;
  const body = await ctx.request.json().catch(() => ({}));
  const patch = {};
  if (Array.isArray(body.hours)) patch.hours = body.hours;             // jam operasional
  if (typeof body.price === 'number') patch.price = body.price;        // harga
  if (typeof body.temporarilyClosed === 'boolean') patch.temporarilyClosed = body.temporarilyClosed; // tutup darurat
  if (typeof body.totalNumbers === 'number') patch.totalNumbers = body.totalNumbers;                  // total nomor
  if (typeof body.breakStart === 'string') patch.breakStart = body.breakStart;                        // istirahat mulai
  if (typeof body.breakEnd === 'string') patch.breakEnd = body.breakEnd;                              // istirahat selesai
  const settings = await saveSettings(getEnv(ctx), patch);
  return json({ ok: true, settings });
};
```

---

## 9. Ringkasan Alur Data (urutan membaca untuk pemula)

1. Mulai dari **route** (`src/pages/api/*.ts`) — ini "pintu".
2. Route memanggil **`getRepo`** → pilih D1/memory, dan **`getSettings`** → baca pengaturan.
3. Route memanggil **`repo.xxx`** (logika di `db.ts`).
4. `repo.xxx` pakai **`storage`** (D1/memory) untuk baca/tulis data.
5. Route balikin respons lewat **`json(...)`**.

Lupakan sejenak file React/astro (itu di sisi browser); backend ini yang menentukan "aturan main"-nya: siapa boleh booking, kapan tutup, bagaimana antrian berjalan.

> Tip belajar: coba trace 1 alur saja dulu — mis. **"Klik Book Now → submit booking"**: `BookingWizard.tsx` (browser) → `fetch /api/book` → `api/book.ts` (route) → `getSettings` + `verifyTurnstile` → `repo.book` → `storage.insertBooking` → balik JSON.