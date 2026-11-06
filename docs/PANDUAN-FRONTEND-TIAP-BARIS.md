# Panduan Frontend — Penjelasan Tiap Baris

Dokumen ini menjelaskan **setiap baris** kode sisi **client/browser** (React islands + helper) untuk proyek Pangkas Rambut Dodik.

> Bedanya dengan dokumen backend: backend jalan di server (Cloudflare Worker), frontend ini jalan di **browser pengunjung**.

---

## 0. Konsep Frontend (Astro Islands)

Astro merender HTML (`.astro`) di server, lalu **React islands** (`client:load`) "hidup" di browser untuk membuat halaman interaktif.

```text
Server (Astro) merender HTML shell
   → halaman: index.astro, book.astro, status.astro, admin.astro
   → menyisipkan komponen React dengan client:load
   │
   ▼
Browser mengunduh JS React → "hydrate" (jalankan) island
   → BookingWizard, StatusPanel, AdminPanel, LiveQueue
   │
   ▼
Island memanggil API lewat fungsi di src/lib/api.ts (fetch)
   → menampilkan data / merespons klik user
```

Kunci: **util.ts + api.ts** = "jembatan" antara UI dan backend.

---

## 1. `src/lib/util.ts` — Helper & tipe bersama

```ts
export const CONFIG = {           // nilai default (fallback)
  totalNumbers: 40,               // jumlah nomor default
  slotMinutes: 15,                // durasi tiap slot (menit)
  startHour: 6, startMinute: 30,  // jam mulai 06:30
  demoAdminPassword: 'dodik',     // password demo (hanya untuk hint dev)
};

export type BookingStatus = 'booked' | 'serving' | 'done' | 'skipped' | 'cancelled'; // 5 kemungkinan status booking

export interface Booking {        // bentuk 1 data booking
  id, date, number, slot_time, customer_name, customer_phone, status, created_at, updated_at, wa_last_notified_at?;
};

export interface QueueState { date; currently_serving: number; updated_at: number }; // "sedang dilayani #X"

export interface QueueInfo {      // bentuk data antrian yang diterima dari /api/queue
  date; currently_serving; is_closed; total_numbers; booked: number[];
  serving: number | null; done: number[]; skipped: number[]; remaining: number;
  slot_times?: string[];          // jam tiap nomor (dari server, break-aware)
};

export interface BookResult { ok; error?; booking? }; // hasil POST /api/book

export const PILL = { booked: 'pill booked', serving: 'pill serving', ... }; // kelas CSS untuk warna status

export const STATUS_LABEL = { booked: 'Dipesan', serving: 'Dilayani', done: 'Selesai', skipped: 'Dilewati', cancelled: 'Dibatalkan' }; // teks Indonesia status

// ===== waktu WIB =====
export function todayWIB() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // "YYYY-MM-DD" dalam WIB
}
export function currentDayWIB() {
  return new Date(todayWIB() + 'T00:00:00').getDay(); // 0=Minggu .. 6=Sabtu
}
export function slotTime(n) {
  const total = CONFIG.startHour * 60 + CONFIG.startMinute + (n - 1) * CONFIG.slotMinutes; // menit sejak 00:00
  const h = Math.floor(total / 60); const m = total % 60; // ubah ke jam & menit
  return pad(h) + ':' + pad(m); // "HH:MM" (catatan: ini versi SEDERHANA tanpa istirahat; yang break-aware ada di backend)
}
export function formatMinutes(min) { ... } // "±15 menit lagi" dsb.
export function firstName(name) { return name.trim().split(/\s+/)[0]; } // ambil kata pertama nama

// ===== WhatsApp =====
export function toWaPhone(phone) {
  const digits = String(phone).replace(/\D/g, ''); // buang non-angka
  if (digits.length < 9 || digits.length > 15) return null; // di luar rentang → tidak valid
  if (digits.startsWith('62')) return digits;        // sudah internasional
  if (digits.startsWith('0')) return '62' + digits.slice(1); // 0812 → 62812
  return '62' + digits;                              // 812 → 62812
}
export function buildWaUrl(phone, message) {
  const wa = toWaPhone(phone); if (!wa) return null;          // nomor tak valid → tidak ada tautan
  return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(message); // tautan klik-ke-chat
}
export function waTemplate(booking, state, status) {           // PESAN WA sesuai status
  const nama = firstName(booking.customer_name);
  const n = booking.number;
  switch (status) {
    case 'booked': { // masih antri → bedakan "dekat" vs "jauh"
      const diff = n - state.currently_serving;
      if (state.currently_serving > 0 && diff <= 2 && diff > 0) return '...akan segera dipanggil...';
      return '...tercatat...perkiraan jam ' + booking.slot_time + '...';
    }
    case 'serving': return '...giliran Anda tiba...';
    case 'done':    return '...terima kasih...';
    case 'skipped': return '...nomor terlewat...';
    default: return '';
  }
}

// ===== status "efektif" =====
export function effectiveStatus(b, state) { ... } // sama seperti di backend: gabung status booking + posisi antrian
```

---

## 2. `src/lib/api.ts` — Jembatan ke API (fetch)

```ts
async function jfetch(url, init?) {                 // helper fetch umum
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' }, // beri tahu server: body berupa JSON
    ...init,                                        // tempel method/body dari pemanggil
  });
  const data = await res.json().catch(() => ({}));  // baca jawaban JSON (aman bila kosong)
  if (!res.ok) {                                    // status bukan 2xx = ada error
    return { ok: false, error: data?.error || 'Terjadi kesalahan (' + res.status + ')', status: res.status, data };
  }
  return data;                                      // sukses → kembalikan data
}

export function fetchQueue() { return jfetch('/api/queue'); } // GET antrian

export function apiBook(number, name, phone, turnstileToken?) {
  return jfetch('/api/book', { method: 'POST',
    body: JSON.stringify({ number, name, phone, turnstile_token: turnstileToken ?? '' }) }); // kirim data booking (+ token captcha)
}

export function apiCancel(number, phone) { return jfetch('/api/cancel', { method: 'POST', body: JSON.stringify({ number, phone }) }); }
export function apiLookup(phone) { return jfetch('/api/lookup', { method: 'POST', body: JSON.stringify({ phone }) }).then((d) => d.booking || null); }

export function apiAdminLogin(password) { ... }
export function apiAdminLogout() { ... }
export function apiAdminList() { ... }
export function apiAdminNext() { ... }
export function apiAdminSkip() { ... }
export function apiAdminReset() { ... }
export function apiAdminDemoFill() { ... }

export interface SettingsInfo { hours; price; priceLabel; temporarilyClosed; totalNumbers; breakStart; breakEnd; is_closed_today?; } // bentuk pengaturan
export function apiGetSettings() { return jfetch('/api/settings'); }
export function apiSaveSettings(patch) { return jfetch('/api/admin/settings', { method: 'POST', body: JSON.stringify(patch) }); }
export function apiAdminNotify(id) { return jfetch('/api/admin/notify', { method: 'POST', body: JSON.stringify({ id }) }); }

// ===== penanda "booking saya" di HP ini (localStorage) =====
const keyMyBooking = () => 'pd_mybooking_' + todayWIB();   // key per hari
export function getMyBooking() { ... baca localStorage ... }
export function setMyBooking(b) { ... tulis/hapus localStorage ... }
// → dipakai agar halaman /status "ingat" booking pengunjung di perangkatnya (tanpa login)
```

---

## 3. `src/components/react/BookingWizard.tsx` — Wizard Booking 3 langkah

```tsx
import { useEffect, useState } from 'react';          // hook React
import site from '../../data/site.json';             // data statis (nama layanan, dll.)
import { slotTime } from '../../lib/util';           // fallback jam slot sederhana
import { apiBook, fetchQueue } from '../../lib/api'; // panggil API
import TurnstileWidget from './TurnstileWidget';     // captcha
import NumGrid from './NumGrid';                     // grid nomor (komponen bersama)

export default function BookingWizard({ turnstileSiteKey }) { // props: site key captcha (dari book.astro)
  const [step, setStep] = useState(1);                 // langkah 1/2/3
  const [selected, setSelected] = useState(null);      // nomor yang dipilih
  const [name, setName] = useState('');                // nama
  const [phone, setPhone] = useState('');              // HP
  const [error, setError] = useState(null);            // pesan error
  const [done, setDone] = useState(false);             // sudah dikirim?
  const [q, setQ] = useState(null);                    // data antrian (dari API)
  const [turnstileToken, setTurnstileToken] = useState(null); // token captcha

  useEffect(() => { fetchQueue().then(setQ).catch(() => setQ(null)); }, []); // saat mount → ambil antrian

  const closed = q?.is_closed ?? false;               // toko tutup?

  if (closed) return ( ... banner "Hari ini tutup" ... );   // kalau tutup, tampilkan banner + tombol kembali
  if (!q) return <div className="loading">Memuat nomor…</div>; // masih loading

  const submit = () => {                              // tombol "Konfirmasi Booking"
    setError(null);                                   // reset error
    if (selected == null) return;                     // belum pilih nomor → diam
    const phoneDigits = phone.replace(/\D/g, '');     // cek HP
    if (phoneDigits.length < 9 || phoneDigits.length > 13) { setError('Nomor HP tidak valid...'); return; }
    if (turnstileSiteKey && !turnstileToken) { setError('Selesaikan captcha...'); setStep(2); return; } // wajib captcha
    apiBook(selected, name, phone, turnstileToken).then((r) => { // kirim ke server
      if (r.ok) { setDone(true); window.location.href = '/status'; } // sukses → pindah ke /status
      else setError(r.error || 'Gagal booking.');                    // gagal → tampilkan error
    });
  };

  return (
    <div className="wizard">
      <div className="steps-indicator"> ... 3 titik indikator langkah ... </div>

      {step === 1 && ( ... <h2>1. Pilih Nomor</h2> ... <NumGrid q={q} selectable selected onSelect={setSelected} /> ... button "Lanjut" ... )}
      {step === 2 && ( ... input nama + HP + warning WhatsApp + TurnstileWidget ... button "Kembali"/"Lanjut" ... )}
      {step === 3 && ( ... ringkasan (nomor, jam, layanan, nama, HP) ... button "Konfirmasi Booking" ... )}
    </div>
  );
}
```

**Alur:** pilih nomor (step 1) → isi data + captcha (step 2) → konfirmasi (step 3) → `apiBook()` → redirect `/status`.

---

## 4. `src/components/react/NumGrid.tsx` — Grid nomor 1..N

```tsx
import ScissorsIcon from './ScissorsIcon';          // ikon gunting
import { slotTime } from '../../lib/util';

export default function NumGrid({ q, selectable = false, selected = null, onSelect }) {
  const statusOf = (n) => {                          // tentukan status tiap nomor
    if (q.serving === n) return 'serving';           // sedang dilayani
    if (q.done.includes(n)) return 'done';           // selesai
    if (q.skipped.includes(n)) return 'skipped';     // dilewati
    if (q.booked.includes(n)) return 'booked';       // sudah diambil (antri)
    return 'available';                              // bebas
  };

  return (
    <div className="num-grid">
      {Array.from({ length: q.total_numbers }, (_, i) => i + 1).map((n) => { // buat array [1..total]
        const st = statusOf(n);
        const isSelected = selected === n;
        const clickable = selectable && (st === 'available' || isSelected); // hanya bisa klik yang bebas/terpilih
        return (
          <button key={n} type="button"
            className={`num-btn ${st !== 'available' ? st : ''} ${isSelected ? 'selected' : ''}`} // kelas warna
            disabled={!clickable}
            onClick={() => onSelect?.(isSelected ? null : n)} // pilih / batalkan pilih
            aria-pressed={isSelected}>
            {st === 'serving' ? (
              <><ScissorsIcon className="scissors-anim" />{n}</>  // nomor sedang dilayani → ikon gunting + angka
            ) : (
              <>{n}<small>{q.slot_times?.[n - 1] ?? slotTime(n)}</small></> // lainnya: angka + jam slot
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Dipakai di **2 tempat**: wizard (bisa klik, `selectable`) dan halaman status (read-only).

---

## 5. `src/components/react/LiveQueue.tsx` — Kartu antrian di landing

```tsx
import { useEffect, useState } from 'react';
import { fetchQueue } from '../../lib/api';

export default function LiveQueue() {
  const [q, setQ] = useState(null);

  useEffect(() => {
    let mounted = true;                                   // penanda komponen masih terpasang
    const load = () => fetchQueue().then((next) => { if (mounted) setQ(next); }).catch(() => { if (mounted) setQ(null); });
    load();                                                // ambil sekali
    const id = setInterval(load, 30000);                   // ulangi tiap 30 detik
    return () => { mounted = false; clearInterval(id); };  // bersihkan saat unmount (hindari kebocoran)
  }, []);

  return (
    <div className="live-card">
      ... "Langsung dari kursi Dodik" ...
      ... "Sedang Dilayani #X" + "Nomor Tersisa N" ...
    </div>
  );
}
```

---

## 6. `src/components/react/QueueTicket.tsx` — Tiket "Sedang Dilayani"

```tsx
export default function QueueTicket({ number, remaining, closed }) {
  return (
    <div className="queue-ticket">          // kartu bergaya tiket (CSS: strip sobek + garis putus-putus)
      <div className="ticket-stub" />       // bagian "stub" tiket (dekorasi)
      <div className="ticket-body">
        {closed ? <div className="ticket-closed">Tutup Hari Ini</div> : (   // kalau tutup
          <><div className="ticket-label">Sedang Dilayani</div>            // label kecil
           <div className="ticket-number">{number > 0 ? `#${number}` : '—'}</div>  // nomor BESAR
           {typeof remaining === 'number' && <div className="ticket-sub">Tersisa <b>{remaining}</b> nomor</div>}</>
        )}
      </div>
    </div>
  );
}
```

---

## 7. `src/components/react/StatusPanel.tsx` — Halaman /status

```tsx
import { useEffect, useState } from 'react';
import site from '../../data/site.json';
import { CONFIG, effectiveStatus, firstName, PILL, STATUS_LABEL } from '../../lib/util';
import { apiCancel, apiLookup, fetchQueue, getMyBooking, setMyBooking } from '../../lib/api';
import NumGrid from './NumGrid';
import QueueTicket from './QueueTicket';

function statusMessage(b, q) { ... } // buat kalimat sesuai status booking pengunjung ("Segera datang!", "Giliran Anda!", dst.)

export default function StatusPanel() {
  const [q, setQ] = useState(null);              // data antrian
  const [myBooking, setMyBookingState] = useState(null); // booking Saya (dari localStorage/API)
  const [lookupPhone, setLookupPhone] = useState('');    // input HP untuk cek
  const [lookupMsg, setLookupMsg] = useState(null);      // pesan dari cek HP
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const qq = await fetchQueue().catch(() => null);   // ambil antrian
      if (!mounted) return;
      setQ(qq);
      const m = getMyBooking();                          // ada "booking saya" di HP ini?
      if (m) { const b = await apiLookup(m.phone).catch(() => null); if (mounted) setMyBookingState(b); }
    };
    refresh();
    const id = setInterval(refresh, 20000);              // polling tiap 20 detik
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const doLookup = async () => { ... }  // cek status via HP → simpan sebagai "booking saya"
  const doCancel = async () => { ... }  // batalkan booking saya
  const doForget = () => { ... }        // lupakan di perangkat ini

  if (!q) return <div className="loading">Memuat…</div>;
  if (q.is_closed) return ( ... "Hari ini tutup" ... );

  return (
    <div className="status-wrap">
      {myBooking ? (
        ... status booking Saya (nomor besar + pesan + tombol batal/lupakan) ...
      ) : (
        <>  // TAMPILAN PUBLIK (tanpa booking):
          <QueueTicket number={q.currently_serving} remaining={q.remaining} />  // tiket sedang dilayani
          <NumGrid q={q} />                                                     // grid antrian (read-only)
          <div className="wizard"> ... form "Cek status saya" via HP ... </div>
        </>
      )}
    </div>
  );
}
```

---

## 8. `src/components/react/AdminPanel.tsx` — Panel Admin (paling besar)

Struktur utama (bukan baris-demi-baris, tapi bagian pentingnya):

```tsx
// ===== state =====
const [authed, setAuthed] = useState(null);   // null=cek login, true=sudah, false=belum
const [pw, setPw] = useState('');             // input password
const [list, setList] = useState([]);         // daftar booking
const [q, setQ] = useState(null);             // data antrian
const [settings, setSettings] = useState(null); // pengaturan
const [autoWa, setAutoWa] = useState(true);   // checkbox "kirim WA pengingat"
const [tab, setTab] = useState('antrian');    // tab aktif: antrian | pengaturan
const [hours, setHours] = useState([]);       // editor jam operasional
const [price, setPrice] = useState(0);        // editor harga
const [totalNumbers, setTotalNumbers] = useState(40); // editor total nomor
const [breakStart, setBreakStart] = useState('');     // istirahat mulai
const [breakEnd, setBreakEnd] = useState('');         // istirahat selesai

const refresh = async () => {                // ambil SEMUA data sekaligus
  setQ(await fetchQueue());                  // antrian
  const lr = await apiAdminList();           // daftar booking
  if (lr.ok) { setAuthed(true); setList(lr.bookings || []); } else { setAuthed(false); } // 200 → login, 401 → belum
  const st = await apiGetSettings();         // pengaturan
  if (st) { setSettings(st); setHours(st.hours || []); setPrice(st.price); setTotalNumbers(st.totalNumbers || 40); setBreakStart(st.breakStart || ''); setBreakEnd(st.breakEnd || ''); }
};
useEffect(() => { refresh(); }, []);         // jalankan saat halaman dibuka

// ===== aksi antrian =====
const doNext = async () => {
  const r = await apiAdminNext();            // panggil nomor berikutnya
  await refresh();
  let remindedNumber;
  if (r.ok && autoWa && r.next != null) {   // jika checkbox "kirim WA pengingat" aktif
    const updated = await apiAdminList();
    const nextUp = (updated.bookings || []).filter((b) => b.status === 'booked' && b.number > r.next)
      .sort((a, b) => a.number - b.number)[0]; // cari ORANG BERIKUTNYA (bukan yang baru dipanggil)
    if (nextUp) {
      const url = buildWaUrl(nextUp.customer_phone, waTemplate(nextUp, q??, 'booked')); // pesan "segera datang"
      if (url) window.open(url, '_blank', 'noopener,noreferrer'); // buka WhatsApp
      remindedNumber = nextUp.number;
    }
  }
  flash(...);                                // toast
};
const doSkip = async () => { await apiAdminSkip(); await refresh(); ... }; // lewati
const doReset = async () => { ... konfirmasi lalu apiAdminReset ... };     // reset
const doDemoFill = async () => { ... apiAdminDemoFill ... };               // isi demo

// ===== FU WhatsApp (manual, per baris) =====
const doWa = (b) => {
  const st = effectiveStatus(b, q);                  // status calon penerima
  const url = buildWaUrl(b.customer_phone, waTemplate(b, q, st)); // pesan sesuai status
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer'); // buka WA
  apiAdminNotify(b.id).then(() => refresh());        // catat timestamp FU → tombol berubah ✓
};

// ===== simpan pengaturan =====
const saveHours = ... savePrice = ... saveTotalNumbers = ... saveBreak = ... toggleClose = ... // masing-masing panggil apiSaveSettings({ ... })

// ===== render =====
if (authed === null) return <div className="loading">Memeriksa sesi…</div>; // sedang cek
if (!authed) return ( ... form login (password) ... );                         // belum login

// sudah login:
<div className="admin-tabs"> tab "📋 Antrian" | "⚙️ Pengaturan" </div>
// tab Antrian  → kartu sedang dilayani + 3 tombol + checkbox WA + daftar booking (dengan FU marker ✓ jam)
// tab Pengaturan → editor jam operasional + harga + total nomor + jam istirahat + tutup darurat
```

**FU marker (penting):** tiap baris booking menampilkan tombol:
- Belum di-FU → 💬 (hijau), klik → buka WA + `apiAdminNotify(id)` (simpan `wa_last_notified_at`).
- Sudah di-FU → **✓** (outline hijau) + label **"FU 09:15"** (jam terakhir).

---

## 9. Komponen kecil

### `TurnstileWidget.tsx` — captcha
Memuat skrip Turnstile sekali, render widget ke `<div>`, lalu panggil `onToken()` saat pengguna lolos / token kedaluwarsa. (Jika `siteKey` kosong → widget tidak dirender = captcha nonaktif.)

### `ScissorsIcon.tsx` — ikon gunting SVG
SVG gunting hitam dengan animasi **SMIL** (`<animateTransform rotate>`), membuka-menutup loop 1.4 detik. Dipakai di tile nomor yang sedang dilayani (via `NumGrid`).

---

## 10. Komponen Astro (HTML shell)

### `BaseLayout.astro`
Kerangka `<html><head><body>`. Isi head: meta title/description/SEO, font, favicon, OG. Body memuat `<slot />` (tempat halaman ditanam). **Tidak ada JSON-LD di sini** (dipindah ke `index.astro` karena butuh data setting yang dinamis).

### `Header.astro`
Nav atas: logo + "Beranda" + "Status" + tombol **"Ambil Nomor"**. Ada `<script>` kecil untuk efek `scrolled` (garis bawah header muncul saat di-scroll).

### `Footer.astro`
Footer 3 kolom: nama & lokasi, navigasi, area layanan + link **"Masuk Admin"**.

### `index.astro` (halaman utama — SSR dari pengaturan)
Frontmatter-nya (baris atas, dieksekusi di server saat request):
```astro
export const prerender = false;                 // halaman ini dirender on-demand (bukan static)
const settings = await getSettings();           // baca pengaturan dari D1
Astro.response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=60'); // cache 60 dtk
const closedToday = isClosedToday(settings);    // tutup hari ini?
const slotTimes = ... ;                          // (bila perlu)
// lalu buat JSON-LD (HairSalon + FAQPage) dari settings di sini
```
Body: section Hero → Cara Booking → Layanan+Barber → Kenapa Booking → LiveQueue (island) → Jam Operasional (dari `settings.hours`) → Lokasi & WA → Tanya Jawab (FAQ, jawaban harga/jam diinterpolasi dari settings).

### `book.astro` / `status.astro` / `admin.astro`
Masing-masing = shell + satu island:
- `book.astro` → `<BookingWizard client:load turnstileSiteKey={...} />`
- `status.astro` → `<StatusPanel client:load />`
- `admin.astro` → `<AdminPanel client:load />` (dengan `robots="noindex, nofollow"` agar tidak terindeks Google)

---

## Ringkasan Alur (trace 1 fitur)

**Booking:** klik "Ambil Nomor" → `book.astro` → `BookingWizard` (pilih nomor → isi data → captcha) → `apiBook()` di `api.ts` → POST `/api/book` → backend memvalidasi & menyimpan → redirect `/status`.

**Cek status:** buka `/status` → `StatusPanel` → `fetchQueue()` tiap 20 dtk → tampilkan tiket "Sedang Dilayani" + grid nomor + form cek HP.

**Admin:** login → `AdminPanel` refresh (antrian + pengaturan) → "Panggil Berikutnya" memanggil N + kirim WA pengingat ke N+1 (jika checkbox aktif), FU manual per baris dicatat jamnya, dan semua pengaturan (jam/harga/total/istirahat/tutup) disimpan ke D1 lewat `apiSaveSettings`.