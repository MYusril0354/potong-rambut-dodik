# PRD — Pangkas Rambut Dodik Pandaan
## Sistem Booking Nomor Antrian Online (Landing Page + SPA + Admin)

| | |
|---|---|
| **Versi** | 1.2 (konsolidasi final dari seluruh sesi konsultasi) |
| **Pemilik Produk** | [Anda — developer/agency] |
| **Klien** | Pangkas Rambut Dodik, Pandaan, Kabupaten Pasuruan |
| **Status** | Final draft untuk vibe coding dengan AI agent |
| **Tanggal** | November 2026 |

> Dokumen ini disusun ulang sebagai **satu PRD utuh** dari sebuah sesi konsultasi panjang (60 pesan) yang membahas: konsep awal SPA booking → keputusan tech stack → personalisasi bisnis "Pangkas Rambut Dodik" → PRD v1.0 → penambahan 5 section landing (v1.1) → fitur follow-up WhatsApp di admin → keputusan animasi → harga & skrip pitching. Semua keputusan yang "final" sudah dilebur ke bawah. Item yang belum dikonfirmasi klien ditandai 🟡.

---

## Changelog

| Versi | Perubahan utama |
|---|---|
| v1.0 | PRD dasar: Astro + Cloudflare Workers/D1, booking antrian 1–40, wizard 3 langkah, status page, admin panel |
| v1.1 | +5 section landing baru (Cara Booking, Kenapa Booking Online, Jam Operasional, Lokasi & Kontak, FAQ), JSON-LD `FAQPage`, FAQ siap pakai |
| v1.2 (ini) | + Fitur follow-up WhatsApp (`wa.me`) di admin panel, + keputusan animasi (hero entrance + View Transitions), + harga penawaran & skrip pitching |

---

## 1. Latar Belakang & Masalah

Pangkas Rambut Dodik adalah barbershop **satu kursi** di Pandaan, Kabupaten Pasuruan. Saat ini:

- Tidak punya website / booking online.
- Pelanggan datang langsung, menunggu tanpa estimasi waktu.
- Pemilik (Pak Dodik) tidak bisa mengelola antrian transparan.
- Tidak ada data untuk memahami kebiasaan pelanggan.

**Peluang:** sistem booking **nomor antrian sederhana (1–40/hari)** yang bisa diakses dari HP, panel admin ringan, biaya operasional **Rp 0/bulan** via Cloudflare free tier.

---

## 2. Tujuan Produk

### Tujuan utama
1. Pelanggan **booking nomor antrian dari HP tanpa login**.
2. Pelanggan melihat **estimasi datang yang jujur** (bukan janji jam pasti).
3. Pemilik mengelola antrian dengan **3 tombol**: Panggil Berikutnya, Lewati, Reset.
4. Pemilik bisa **follow-up (FU) pelanggan via WhatsApp** langsung dari admin (1 klik → `wa.me`).
5. Biaya hosting tetap **Rp 0/bulan** (Cloudflare free tier).
6. Landing page **SEO-friendly** untuk pencarian lokal.

### Metrik keberhasilan (setelah 3 bulan live)
- ≥30% pelanggan harian pakai booking online.
- Zero biaya operasional bulanan.
- Pemilik bisa operasikan admin tanpa pendampingan setelah 1 sesi latihan.
- Lighthouse ≥ 95 (Performance, SEO, Best Practices).
- Terindeks Google minimal 3 keyword: "pangkas rambut Pandaan", "cukur Pandaan", "barbershop Pandaan".

---

## 3. Target Pengguna

**Persona 1 — Pelanggan** (warga Pandaan & sekitar): usia 15–55, mayoritas pria, HP 4G, tidak mau menunggu lama, tidak mau bikin akun.

**Persona 2 — Admin (Pak Dodik)**: satu orang, familiar HP Android + WhatsApp, **tidak** familiar istilah teknis, ingin tombol sederhana.

---

## 4. Scope

### ✅ In Scope (MVP)
- Landing page SEO-friendly (10 section, statis).
- Wizard booking 3 langkah (pilih nomor → isi nama/HP → konfirmasi).
- 40 nomor/hari, interval 15 menit, mulai 06:30 WIB.
- Deteksi tutup Jumat otomatis (Jumat & Minggu tutup).
- Halaman status antrian live (polling 20 detik).
- Customer batal booking sebelum dipanggil.
- Panel admin: login password tunggal + 3 tombol aksi.
- **Fitur FU WhatsApp:** tombol WA per baris + checkbox "Kirim WA juga" saat panggil.
- Data di Cloudflare D1.
- Deployment GitHub → Cloudflare Workers Builds + rollback.
- FAQ + JSON-LD `FAQPage` + `HairSalon`.
- Google Maps embed (iframe manual).

### ❌ Out of Scope
- Multi-stylist / multi-cabang.
- Pembayaran online.
- Notifikasi WhatsApp/SMS **otomatis** (WA di sini manual klik oleh owner).
- Aplikasi mobile native.
- Login/riwayat pelanggan.
- Analitik terintegrasi (manual via log D1).
- Ulasan Google Maps otomatis.
- Galeri foto / blog / embed Instagram.

---

## 5. Tech Stack & Arsitektur

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Astro + React island (wizard, status, admin) | SEO statis + interaktivitas terisolasi |
| Styling | Tailwind v4 atau CSS + design tokens | Ringan, responsif |
| Backend | Cloudflare Workers (Hono optional) | Free 100k req/hari, edge |
| Database | Cloudflare D1 (SQLite) | Free 5M reads / 100k writes per hari |
| Auth admin | Password → HttpOnly cookie HMAC | Simpel 1 admin, anti-XSS |
| Realtime | HTTP polling 20 detik | Lebih murah dari WebSocket/Durable Objects |
| Deployment | GitHub → Cloudflare Workers Builds | Rollback mudah |
| Domain | `*.workers.dev` (v1), custom opsional | Gratis MVP |
| Peta | Google Maps iframe (tanpa API key) | Gratis |
| WA follow-up | `wa.me` click-to-chat (client-side murni) | Gratis, tanpa WA Business API |

### Arsitektur (rute)

```
Cloudflare Worker (single deployment)
  GET  /              → Landing (static)
  GET  /book          → Wizard (island)
  GET  /status        → Status (island)
  GET  /admin         → Admin (island)
  GET  /api/queue     → status antrian
  POST /api/book      → buat booking
  POST /api/cancel    → batal (customer)
  POST /api/lookup    → cek via HP
  POST /api/admin/login|next|skip|reset
  GET  /api/admin/list
        ↓
   D1 (SQLite): bookings, queue_state
```

**Catatan agent:** Astro hybrid rendering — landing prerender, halaman interaktif `output: 'server'` dengan `@astrojs/cloudflare`. `wa.me` **tanpa endpoint API** (murni client-side), untuk menghindari PII tersimpan di log server.

---

## 6. Data Model (D1)

```sql
CREATE TABLE bookings (
  id            TEXT PRIMARY KEY,          -- UUID v4
  date          TEXT NOT NULL,             -- 'YYYY-MM-DD' (WIB)
  number        INTEGER NOT NULL,          -- 1..40
  slot_time     TEXT NOT NULL,             -- '06:30', dst.
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'booked',
                -- ENUM: booked | serving | done | skipped | cancelled
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  wa_last_notified_at TEXT,                -- opsional, untuk analitik (v1.2)
  UNIQUE(date, number)                     -- anti race-condition
);
CREATE INDEX idx_bookings_date_status ON bookings(date, status);
CREATE INDEX idx_bookings_phone_date ON bookings(customer_phone, date);

CREATE TABLE queue_state (
  date TEXT PRIMARY KEY,
  currently_serving INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
```

### Aturan data
- **Timezone:** hitung dalam **WIB (UTC+7)** via `Intl.DateTimeFormat` `timeZone:'Asia/Jakarta'`.
- **`slot_time` =** `06:30 + (number-1) × 15 menit` (no.1 = 06:30, no.40 = 16:15).
- **Transisi status sah:** `booked→serving`, `serving→done`, `booked→skipped`, `booked→cancelled`.
- **Satu HP = satu booking aktif/hari** → error `409` jika duplikat.
- `UNIQUE(date,number)` adalah pertahanan utama race-condition.

---

## 7. API Endpoints

Semua respons JSON. Endpoint publik tanpa auth; `/api/admin/*` butuh cookie `admin_session`.

| Method | Path | Fungsi | Auth |
|---|---|---|---|
| GET | `/api/queue?date=` | Status antrian (tanpa nama/HP) | ❌ |
| POST | `/api/book` | Buat booking | ❌ |
| POST | `/api/cancel` | Batal booking | ❌ |
| POST | `/api/lookup` | Cek via HP | ❌ |
| POST | `/api/admin/login` | Login, set cookie HMAC | ❌ |
| POST | `/api/admin/next` | Panggil berikutnya | ✅ |
| POST | `/api/admin/skip` | Lewati nomor | ✅ |
| POST | `/api/admin/reset` | Reset hari ini | ✅ |
| GET | `/api/admin/list` | Daftar booking + nama/HP | ✅ |

**Detail penting:**
- `GET /api/queue` wajib **tidak** mengembalikan nama/HP (hanya nomor + status).
- `POST /api/book` error: `409` (nomor/HP terpakai), `423` (Jumat tutup), `422` (validasi), sukses `201`.
- `POST /api/admin/login`: rate limit 5 percobaan/menit/IP (`429`). Cookie `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`.
- Semua input **re-validasi di server** (nama ≤100 char, HP regex `^[0-9+\-\s]{8,20}$`, nomor 1–40).

---

## 8. Frontend

### 8.1 Landing Page (`/`) — 10 section (statis, prerender)

| # | Section | Tujuan |
|---|---|---|
| 1 | Header | Nav + CTA "Book Now" |
| 2 | Hero | Headline + CTA utama |
| 3 | Cara Booking | 3 langkah visual |
| 4 | Kartu Layanan | Harga & durasi |
| 5 | Kartu Barber | Siapa yang potong |
| 6 | Kenapa Booking Online | 4 poin manfaat |
| 7 | Live Queue Card | "Giliran siapa?" (island) |
| 8 | Jam Operasional | Tabel per hari + highlight hari ini |
| 9 | Lokasi & Kontak | Peta + WA + alamat + area layanan |
| 10 | FAQ | 10 pertanyaan + JSON-LD |

**Jam operasional:**

| Hari | Jam |
|---|---|
| Senin–Kamis | 06:30–17:00 |
| Jumat | **Tutup** |
| Sabtu | 06:30–17:30 |
| Minggu | Tutup |

**Fakta kunci konten:** harga **Rp 13.000** (tunai), durasi ±15 menit, layanan tunggal "Potong Rambut", barber tunggal "Dodik", area layanan: Pandaan, Gempol, Prigen, Sukorejo, Beji. Brand: **"Pangkas Rambut Dodik"**.

**FAQ (10 butir, Bahasa Indonesia):** harga Rp13.000 tunai; bisa langsung datang tapi booking lebih aman; ±15 menit; hanya tunai (TODO QRIS); no-show dilewati; Jumat tutup; bisa anak-anak (TODO); cara batal; same-day only; lokasi Pandaan.

### 8.2 Booking Wizard (`/book`) — 3 langkah
- **Step 1:** grid 40 nomor + slot time; status visual (tersedia/buked/serving/selesai/skip); banner "tutup" jika Jumat.
- **Step 2:** form nama + HP, validasi live.
- **Step 3:** ringkasan + konfirmasi → redirect `/status`.

### 8.3 Status Page (`/status`) — polling 20 detik
- Tampil nomor sedang dilayani + grid antrian.
- Pesan dinamis per status (e.g. "Segera datang!", "🎉 Giliran Anda!", "Nomor dilewati").
- Tombol "Batalkan Booking" (hanya saat `booked`) + "Lupakan booking di perangkat ini".

### 8.4 Admin Panel (`/admin`) — **REVISI v1.2 (FU WhatsApp)**
- **Login** password tunggal.
- **Dashboard:** kartu "sedang dilayani", tombol **Panggil Berikutnya / Lewati / Reset**, daftar booking dengan status pill.
- **Fitur FU WA:**
  - Tombol **WA di setiap baris** booking → buka `wa.me` dengan template sesuai status.
  - Checkbox **"Kirim WA juga ke pelanggan"** (default ON) di bawah "Panggil Berikutnya".
  - Template pesan otomatis per status (placeholder `{nama}`, `{n}`, `{slot}`).
  - Normalisasi nomor HP ke format internasional (`0812…`→`62812…`, `+62…`→`62…`).
  - Tombol WA **disabled** untuk status `cancelled` dan nomor tidak valid (<10 atau >15 digit).
  - `wa.me` dibuka `noopener,noreferrer` (anti-tabnabbing).
- **Demo mode:** data di `localStorage`, tombol WA membuka `wa.me` (dipatenkan ke produksi nanti).

**Template pesan WA (per status):**
- `booked` jauh (>2 nomor): "…tercatat nomor #{n} (perkiraan {slot}). Kami kabari lagi…"
- `booked` dekat (≤2): "…nomor #{n} segera dipanggil. Mohon bersiap…"
- `serving`: "…giliran Anda tiba (nomor #{n}). Silakan ke kursi…"
- `done`: "…terima kasih sudah datang…"
- `skipped`: "…nomor #{n} terlewat. Hubungi kami untuk jadwal ulang…"
- `cancelled`: tombol disabled.

---

## 9. Business Rules (BR-01 … BR-16)

| ID | Aturan |
|---|---|
| BR-01 | 40 nomor/hari, interval 15 menit, mulai 06:30 |
| BR-02 | Tutup Jumat (dan Minggu); endpoint kembalikan `is_closed:true` |
| BR-03 | Satu HP = satu booking aktif/hari |
| BR-04 | Nomor `cancelled` bebas dipesan ulang |
| BR-05 | Nomor `skipped` **tidak** bisa dipesan ulang |
| BR-06 | Customer hanya bisa cancel sebelum `serving` |
| BR-07 | Admin bisa skip nomor yang sedang serving |
| BR-08 | "Panggil Berikutnya" menandai serving sebelumnya `done` (atomik) |
| BR-09 | Reset hari ini menghapus semua booking tanggal aktif |
| BR-10 | Booking same-day saja |
| BR-11 | Semua tanggal dihitung WIB, simpan `YYYY-MM-DD` |
| BR-12 | 40 nomor habis → tampil "Hari ini penuh" (tanpa waitlist) |
| BR-13 | Tombol WA aktif hanya untuk `booked/serving/done/skipped`; `cancelled` disabled |
| BR-14 | Pesan WA menyesuaikan status **saat tombol diklik** |
| BR-15 | Nomor HP dinormalisasi sebelum buat URL `wa.me`; <10/>15 digit → disabled |
| BR-16 | WA dikirim **manual** oleh owner (sistem tidak pernah kirim otomatis) |

---

## 10. Keputusan Desain & Animasi (final)

- Baseline desain: `DESIGN_VARIANCE 8, MOTION_INTENSITY 6, VISUAL_DENSITY 4`.
- Palet: bg `#F7F3ED`, surface `#FFFFFF`, primary `#1E1E1E`, accent gold `#C9A96E`.
- Font: Playfair Display (heading) + Inter (body).
- **Landing:** animasi **hanya di hero** (entrance 0.6s stagger). Section lain **statis** (tanpa fade-in on scroll — demi SEO + CLS + HP low-end). Stagger ringan boleh di "Cara Booking".
- **SPA:** route change pakai **View Transitions API** (native, 180ms) dengan fallback render instan.
- **Wizard step:** pertahankan transisi `fadeSlide`.
- **Semua animasi** hormati `prefers-reduced-motion: reduce`.
- **Hindari:** parallax, count-up angka antrian, fade seluruh halaman, animasi berulang yang distraksi.

---

## 11. SEO & JSON-LD

- Meta: `<title>`, description (<160 char), keywords, OG tags, canonical, `geo.placename`.
- **Dua blok JSON-LD** di `<head>`: `HairSalon` (address, openingHours, priceRange "Rp 13.000", areaServed 5 kecamatan, offerCatalog) + `FAQPage`.
- FAQ JSON-LD **wajib sinkron** dengan HTML — gunakan satu sumber data `faq.json`.
- Semantic HTML (`header/main/section/footer`, `<details>` untuk FAQ).
- `sitemap.xml` (index `/`, `/book`, `/status`; **kecuali** `/admin`), `robots.txt` blokir `/admin` & `/api/*`.
- FAQ jawaban harus ada di HTML statis (view-source terlihat), accordion hanya visual.

---

## 12. Keamanan

| Area | Requirement |
|---|---|
| Admin auth | Password di Worker Secret; cookie HMAC HttpOnly/Secure/SameSite=Strict, expire 8 jam |
| Rate limit | 5 percobaan login/menit/IP |
| Input | validasi server; prepared statements (`.bind()`), anti SQLi |
| XSS | auto-escape; `escapeHtml()` jika render manual |
| Data exposure | `/api/queue` tanpa nama/HP |
| Cookie customer | `my_booking` ditandatangani HMAC |
| Secrets | via `wrangler secret put`, tidak pernah di-commit |
| WA link | `encodeURIComponent` pesan; nomor di-escape; `noopener,noreferrer` |
| Maps iframe | `sandbox` + `referrerpolicy="no-referrer-when-downgrade"` |
| HTTPS | otomatis di workers.dev |

---

## 13. Non-Fungsional

- Lighthouse ≥95 (semua kategori); FCP <1.5s (4G).
- JS bundle: landing <30 KB gzip, booking <80 KB gzip.
- Responsif 360/768/1024/1440px.
- WCAG 2.1 AA (kontras, label, keyboard, aria).
- Polling: status 20s, landing queue 30s.
- Seluruh UI Bahasa Indonesia; font di-subset & preload.

---

## 14. Deployment & CI/CD

- Repo GitHub `pangkas-dodik` (branch `main`, PR → preview).
- Cloudflare Workers Builds (Import from Git): build `npm run build`, deploy `npx wrangler deploy`, `NODE_VERSION=20`.
- Secrets: `ADMIN_PASSWORD`, `ADMIN_SECRET`, `PUBLIC_MAPS_EMBED_URL`, `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_ADDRESS`.
- **Build-time validation:** fail build jika `PUBLIC_WHATSAPP_NUMBER` masih placeholder saat production.
- Migrasi D1 via `wrangler d1 migrations apply`.
- Rollback: dashboard atau `npx wrangler rollback` (catatan: rollback kode ≠ rollback skema D1).

---

## 15. Rencana Milestone (agent)

1. **Phase 1 — Foundation (1–2 hari):** init Astro+Cloudflare+React, D1 + migrasi, `/api/queue` dummy, deploy `*.workers.dev`.
2. **Phase 2 — Booking Core (2–3 hari):** `/api/book|cancel|lookup`, logika Jumat tutup, halaman `/book`, uji duplikat/race.
3. **Phase 3 — Status & Admin (2–3 hari):** `/status` polling, login+HMAC, `/admin` 3 tombol, rate limit, e2e test.
4. **Phase 4 — Landing & SEO (2–3 hari):** 10 section, 2 JSON-LD, sitemap/robots, Lighthouse ≥95, responsif, Rich Results Test.
5. **Phase 5 — Polish & Deploy (1–2 hari):** error/loading states, a11y, Workers Builds, uji rollback, docs Pak Dodik 1 halaman, **FU WA** final.

**Total estimasi:** 8–13 hari agent time.

---

## 16. Acceptance Criteria (DoD)

**Fungsional:** booking <60 detik; anti race-condition & duplikat HP; Jumat `423`; login admin + cookie; status update ≤20 detik; skip permanen; cancel hanya sebelum dipanggil; reset; **tombol WA per baris berfungsi, template sesuai status, normalisasi HP benar, checkbox "Kirim WA juga" berfungsi, `cancelled` disabled, buka `noopener,noreferrer`**.

**Non-fungsional:** Lighthouse ≥95; tanpa error console; keyboard nav penuh; kontras AA; P95 <300ms; tanpa secret di repo; rollback sukses; total scroll landing ≤8 layar; CLS <0.1.

**SEO:** sitemap/robots valid; JSON-LD lolos Rich Results Test; FAQ sync; meta <160 char; terindeks 3 keyword.

---

## 17. Keputusan Konten (status)

| Item | Status | Aksi |
|---|---|---|
| Brand | 🟢 "Pangkas Rambut Dodik" | OK |
| Harga | 🟢 Rp 13.000 | OK |
| Jam | 🟢 Sen–Kam 06:30–17:00, Sab 06:30–17:30, Jumat/Minggu tutup | OK |
| Area layanan | 🟢 Pandaan, Gempol, Prigen, Sukorejo, Beji | OK |
| Testimoni | ❌ dihapus | diganti FAQ + peta; testimoni asli setelah kerja sama |
| Foto hero/barber | 🟡 placeholder | ganti foto asli Dodik |
| Google Business/Maps | 🟡 belum ada | minta tautan GBP; fallback "Pangkas Rambut Dodik Pandaan" |
| Nomor WA Dodik | 🟡 belum ada | wajib sebelum production (fail build jika placeholder) |
| Alamat lengkap | 🟡 "Pandaan" saja | minta detail |
| Metode bayar | 🟡 tunai saja? | konfirmasi QRIS |
| Layani anak | 🟡 belum | konfirmasi |

> Prinsip: item 🟡 pakai placeholder yang jelas terlihat placeholder, jangan mengarang data.

---

## 18. Harga & Positioning Penawaran

Riset pasar: **Rp 7–12 juta** untuk klien barbershop lokal. (Referensi: template murah Rp1,5–4 jt; custom booking system Rp2 jt; agensi Bali mulai Rp16,5 jt; internasional $500–2.000.)

**Nilai jual lebih:** sistem antrian live (bukan booking biasa), serverless Rp0/bulan, landing SEO + SPA hybrid, deployment Git + rollback.

**Pecahan penawaran (contoh):**
- Landing SEO 25%, Sistem booking/antrian 40%, Admin panel 20%, Infrastruktur & deployment 15%.

**Sampaikan ke klien:** biaya bulanan nyaris nol; rollback & keamanan data; skalabel; fitur lanjutan (notifikasi otomatis, pembayaran, mobile) adalah scope tambahan.

---

## 19. Referensi Implementasi

- **Demo HTML standalone:** `pangkas-dodik-demo.html` — file final berisi landing (10 section) + booking wizard + status + admin (dengan FU WA) + animasi (hero entrance + View Transitions). Logika queue/wizard/admin demo via `localStorage`. Ini acuan visual & alur UX untuk implementasi Astro yang sesungguhnya.
- Design tokens & copy Bahasa Indonesia bisa dipindah langsung ke Tailwind config / CSS variables.

---

## 20. Open Questions untuk Klien

1. Google Business Profile (tautan share untuk peta & ulasan).
2. Nomor WhatsApp asli (untuk tombol kontak & fail-build check).
3. Alamat lengkap (desa, jalan, patokan).
4. Foto asli untuk hero & kartu barber.
5. Kebijakan no-show (dilewati → booking ulang atau boleh dipanggil lagi hari itu?).
6. Format nomor HP pelanggan mayoritas (`08xx` atau `+62`?).
7. Metode pembayaran (tunai saja / QRIS / transfer).
8. Layani anak-anak? Harga khusus?
9. Area layanan tambahan selain 5 kecamatan.
10. Gaya bahasa pesan WA (formal / santai)?

---

## 21. Prinsip Kerja untuk Agent

- Urutan pengerjaan ikuti milestone §15; tiap phase lulus DoD §16 sebelum lanjut.
- Jika ada ambiguitas menyangkut **data pelanggan, keamanan, atau konten publik** → **berhenti & tanya**, jangan mengarang.
- Data yang muncul di >1 tempat (FAQ, alamat, WA, area) **wajib** disimpan di `src/data/*.json` (single source of truth) agar HTML & JSON-LD tidak divergen.