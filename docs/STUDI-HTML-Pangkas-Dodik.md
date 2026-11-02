# Studi HTML Mentah — Pangkas Rambut Dodik

Dokumen ini berisi hasil studi terhadap **HTML mentah** yang dihasilkan di dalam percakapan shared chat DeepSeek, serta terhadap **HTML mentah halaman share DeepSeek** itu sendiri yang berhasil saya fetch lewat browser.

---

## 1. Ringkasan hasil fetch

Percakapan di `https://chat.deepseek.com/share/9rkjukzfxzr9oyahmr` adalah sesi konsultasi 60 pesan yang menghasilkan, antara lain, **tiga versi HTML** untuk situs "Pangkas Rambut Dodik Pandaan":

| Versi | Pesan # | Ukuran | Isi |
|---|---|---|---|
| HTML awal (full) | 23 | 58.709 char | Landing + booking wizard + status + admin (tanpa personalisasi) |
| HTML + admin & section | 47 | 82.387 char | Personalisasi Dodik/Pandaan + halaman admin + FU WhatsApp |
| **HTML final (animasi)** | 55 | **83.709 char** | Versi 47 + hero entrance + View Transitions + `prefers-reduced-motion` |

File `pangkas-dodik-demo.html` (di folder root) adalah **versi final (pesan 55)** yang sudah saya bersihkan dari pembungkus markdown chat sehingga menjadi satu file HTML murni yang bisa langsung dibuka.

> **Temuan kunci tentang "html mentah" yang di-fetch:** halaman share DeepSeek adalah SPA React. Konten percakapan **tidak** di-render langsung ke HTML awal — ia dimuat via API `GET /api/v0/share/content?share_id=9rkjukzfxzr9oyahmr` (JSON). Itulah mengapa `curl`/fetch biasa gagal (CloudFront 403/202 challenge) dan hanya browser asli yang bisa mengambilnya.

---

## 2. Anatomi file final (`pangkas-dodik-demo.html`)

Satu file, ~80.868 karakter HTML murni, `<!DOCTYPE html>` → `<html lang="id">` → `<head>` → `<body>`.

### 2.1 `<head>` — SEO & meta
- `<title>Pangkas Rambut Dodik Pandaan — Booking Nomor Antrian Online</title>`
- `meta description` + `keywords` (mengandung "pangkas rambut Pandaan", "cukur Pandaan", "barbershop Pandaan").
- `theme-color`, `geo.region`, `geo.placename`.
- Open Graph (`og:title`, `og:description`, `og:type`, `og:locale`).
- Canonical URL.
- **Dua blok JSON-LD:** `HairSalon` (address, areaServed 5 kecamatan, openingHours, priceRange Rp 13.000, offerCatalog) + `FAQPage` (6 pertanyaan).

### 2.2 `<style>` — design tokens & sistem
- CSS custom properties di `:root` (palet, radius, shadow, font, transisi) — sesuai baseline `variance 8 / motion 6 / density 4`.
- Reset + utility (`.container`, `.sr-only`, `.btn*`).
- `@view-transition { navigation: none }` + override `::view-transition-old/new` (crossfade 0.18s) untuk perpindahan route.
- `@media (prefers-reduced-motion: reduce)` — mematikan seluruh animasi (entrance, toast, pulse, view transition).
- Breakpoint responsif (mobile-first).

### 2.3 `<body>` — struktur SPA hash-routing
Navigasi pakai `data-route-link`; konten halaman pakai `data-route` + atribut `hidden`:

```
header (nav: Beranda / Status / Book Now)
├─ #page-landing  data-route="landing"
│    ├─ section.hero          (headline + CTA)
│    ├─ section.how           (Cara Booking — 3 langkah)
│    ├─ section.focus         (Kartu Layanan + Kartu Barber — digabung)
│    ├─ section.benefits      (Kenapa Booking Online — 4 poin)
│    ├─ section.live          (Live Queue — island)
│    ├─ section.hours         (Jam Operasional — tabel)
│    ├─ section.location      (Peta + WA + alamat + area layanan)
│    └─ section.faq           (10 pertanyaan, <details>)
├─ #page-book     data-route="book"
│    └─ 3× section.panel.step-panel (data-panel=1/2/3)  ← wizard
├─ #page-status   data-route="status"
└─ #page-admin    data-route="admin"
     ├─ #adminLogin
     └─ #adminDashboard  (Panggil Berikutnya / Lewati / Reset + adminAutoWa + daftar booking)
```

### 2.4 `<script>` — logika vanilla JS (tanpa framework)
- **Waktu WIB:** `todayWIB()`, `currentDayWIB()`, `isFriday()` via `Intl`/`toLocaleDateString('en-CA', {timeZone:'Asia/Jakarta'})`.
- **Slot:** `slotTime(n)` → `06:30 + (n-1)×15 menit`.
- **Routing:** `currentRoute()` membaca `location.hash` (#/, #/book, #/status, #/admin) → `renderRoute()` me-toggle `el.hidden` per `data-route`, dibungkus `document.startViewTransition(...)` dengan fallback render instan.
- **Follow-up WhatsApp:** `toWaPhone()` (normalisasi `0812…`→`62812…`), `buildWaUrl()` (`wa.me/<phone>?text=…`, `encodeURIComponent`), `waTemplate()` (pesan per status: booked/serving/done/skipped), tombol WA disable untuk `cancelled` / nomor invalid.
- **Demo store:** objek `store` menyimpan queue/booking/session ke `localStorage` & `sessionStorage` (key per tanggal) — **ini murni simulasi, bukan backend sungguhan**.
- Helper `escapeHtml()`, `firstName()`, `showToast()`, `effectiveStatus()` (menurunkan status live dari `currently_serving`).

---

## 3. Observasi & temuan penting

1. **Konsolidasi section.** PRD v1.1 mendeklarasikan "Kartu Layanan" dan "Kartu Barber" sebagai section terpisah. Di HTML final keduanya **digabung dalam satu `section.focus`** (`focus-grid` berisi kartu layanan + kartu barber). Ada 8 `<section>` di landing (hero, how, focus, benefits, live, hours, location, faq) + header + footer. Saat membangun versi Astro, putuskan apakah ini jadi 10 section terpisah (sesuai PRD) atau tetap dikonsolidasi (sesuai demo).

2. **Demo = client-side penuh.** Tidak ada API; queue di-`localStorage`. Ini cocok untuk **pitching**, tapi produksi harus diganti Astro + Cloudflare Workers/D1 + endpoint `/api/*` sesuai PRD (data tidak boleh hanya di sisi pelanggan, dan `UNIQUE(date,number)` di D1 yang mencegah race-condition).

3. **WA follow-up sudah fungsional** di level kode demo: normalisasi nomor, template per status, checkbox `adminAutoWa`, `noopener,noreferrer`. `wa.me/62XXXXXXXXXX` untuk tombol CTA kontak masih placeholder.

4. **SEO cukup lengkap** untuk file tunggal: dua JSON-LD, OG, canonical, semantic section, `<details>` FAQ. Catatan: FAQ JSON-LD (6 butir) vs FAQ HTML (10 butir) **tidak sinkron** di demo — ini persis risiko yang dicegah PRD lewat satu sumber data `faq.json`.

5. **PHOTO placeholder** Unsplash (`images.unsplash.com/...`) untuk avatar Dodik — harus diganti foto asli.

6. **Animasi sudah sesuai rekomendasi:** hero entrance saja, View Transitions untuk route, `prefers-reduced-motion` penuh, wizard tetap `fadeSlide`.

---

## 4. Kesenjangan demo → produksi (checklist implementasi)

- Ganti `localStorage` store → Cloudflare D1 (`bookings`, `queue_state`) + endpoint API.
- Auth admin demo (`sessionStorage=='1'`) → login HMAC HttpOnly cookie + rate limit.
- Env vars: `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_MAPS_EMBED_URL`, `PUBLIC_ADDRESS`, secrets `ADMIN_PASSWORD`/`ADMIN_SECRET`.
- Build-time validation (fail jika nomor WA placeholder).
- `sitemap.xml` + `robots.txt` (blokir `/admin`, `/api/*`).
- Sinkronkan FAQ HTML ↔ JSON-LD via `faq.json`.
- Migrasi Astro hybrid + React islands (landing prerender).

---

## 5. Catatan soal HTML mentah halaman share DeepSeek

File `share_page.html` (di `.ds-fetch/`) adalah HTML hasil render halaman share-nya, ~390 KB. Strukturnya:
- Aplikasi shell Next/React berjudul **"DeepSeek - Into the Unknown"**.
- Percakapan **tidak embedded** di HTML awal — dirender setelah JS mengambil `GET /api/v0/share/content?share_id=…`.
- Data asli tersimpan di file `nw_628.93.json` (respons API tersebut, ~1,27 MB): berisi `data.biz_data.title` + `data.biz_data.messages[]` (60 pesan) dengan tiap pesan punya `role` (`USER`/`ASSISTANT`) + `fragments[]` bertipe `REQUEST`/`THINK`/`RESPONSE`/`TOOL_*`.
- Transkrip lengkap sudah saya rekonstruksi ke `.ds-fetch/full_conversation.md` (870 KB), dan ringkasan alur ke `.ds-fetch/conversation_flow.tsv`.

**Kesimpulan teknik:** "isi percakapan" bukan di HTML statis, melainkan di payload JSON API. "HTML mentah" yang relevan untuk produk adalah tiga file HTML yang dihasilkan asisten (final-nya sudah saya bersihkan ke `pangkas-dodik-demo.html`).