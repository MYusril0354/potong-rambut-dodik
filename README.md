<p align="center">
  <img src="docs/screenshots/landing.png" alt="Pangkas Rambut Dodik — landing page" width="760">
</p>

<h1 align="center">💈 Pangkas Rambut Dodik</h1>
<p align="center"><b>Sistem booking nomor antrian online</b> untuk barbershop satu kursi di Pandaan, Pasuruan.</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/USERNAME/REPO"><img src="https://img.shields.io/badge/Deploy%20to%20Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Deploy to Cloudflare"></a>
  <a href="https://github.com/USERNAME/REPO/actions/workflows/deploy.yml"><img src="https://img.shields.io/badge/Deploy-GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="Deploy via GitHub Actions"></a>
  <br>
  <img src="https://img.shields.io/badge/Astro-7-FF5D01?logo=astro&logoColor=white" alt="Astro 7">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers + D1">
</p>

---

**Pangkas Rambut Dodik** adalah barbershop satu kursi di Pandaan. Pelanggan bisa **ambil nomor antrian (1–40) langsung dari HP tanpa login**, melihat estimasi giliran yang jujur, dan pemilik (Pak Dodik) mengelola antrian cukup dengan **3 tombol** + follow-up pelanggan via **WhatsApp** — semuanya berjalan di Cloudflare free tier (**Rp 0/bulan**).

## ✨ Fitur

| Area | Fitur |
|---|---|
| **Landing** (`/`) | 10 section SEO-friendly, JSON-LD `HairSalon` + `FAQPage`, responsif, hero animation + View Transitions |
| **Booking** (`/book`) | Wizard 3 langkah, 40 nomor × 15 menit (mulai 06:30 WIB), anti duplikat nomor & HP |
| **Status** (`/status`) | Antrian live (polling 20 dtk), cek via HP, batal booking |
| **Admin** (`/admin`) | Login HMAC, Panggil/Lewati/Reset + follow-up WhatsApp `wa.me` (normalisasi nomor + template per status) |
| **Backend** | Cloudflare Workers + D1 (SQLite), 11 endpoint API, in-memory fallback untuk dev lokal |

## 🧱 Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Astro 7 + React 19 (islands) |
| Styling | CSS custom design tokens (tanpa framework) |
| Runtime | Cloudflare Workers (`@astrojs/cloudflare`) |
| Database | Cloudflare D1 (SQLite) + migrasi |
| Auth | HMAC HttpOnly cookie |
| CI/CD | GitHub Actions + `cloudflare/wrangler-action` |

## 🚀 Quick Start (lokal)

```sh
npm install
npm run dev        # http://localhost:4321
```

- Data demo disimpan di memori (fallback), password admin demo: `dodik`.
- Isi data asli di `src/data/site.json` (lihat **Data & Secret**).

```sh
npm run build      # build produksi ke ./dist
npm run check:data # validasi kelengkapan data klien
```

## ⚡ One-Click Deploy ke Cloudflare

Ada **dua cara**. Metode 1 (GitHub Actions) paling disarankan karena otomatis menangani build + migrasi D1 + deploy.

### Metode 1 — GitHub Actions (disarankan)

1. **Sekali saja:** set 2 secret di repo (Settings → Secrets → Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
2. **Sekali saja:** isi `database_id` D1 di `wrangler.toml` (`npm run d1:create`) dan data klien di `src/data/site.json` sampai `npm run check:data` hijau.
3. Setelah itu, **satu klik**:
   - Buka tab **Actions** → workflow **"Deploy Pangkas Dodik"** → **Run workflow**, ATAU
   - cukup `git push origin main` (deploy otomatis).

> Klik badge **"Deploy · GitHub Actions"** di atas untuk langsung ke tombol Run workflow (ganti `USERNAME/REPO`).

### Metode 2 — Tombol "Deploy with Workers"

Klik **"Deploy to Cloudflare"** di atas (ganti `USERNAME/REPO`) → Cloudflare pandu:
connect repo GitHub → baca `wrangler.toml` otomatis → deploy Worker.

> Setelah itu tetap perlu **sekali**: buat D1 (`npm run d1:create`) → isi `database_id` ke `wrangler.toml` → set secret `ADMIN_PASSWORD` & `ADMIN_SECRET` di dashboard (Workers → Settings → Variables & Secrets).

Selengkapnya: [`DEPLOY-GITHUB.md`](DEPLOY-GITHUB.md) dan [`DEPLOY.md`](DEPLOY.md).

## 📁 Struktur Proyek

```text
├── src/
│   ├── pages/            # route (.astro) + API endpoints (/api/*)
│   │   ├── index.astro   # landing
│   │   ├── book.astro    # booking
│   │   ├── status.astro  # status antrian
│   │   ├── admin.astro   # panel admin
│   │   └── api/          # queue, book, cancel, lookup, admin/*
│   ├── components/
│   │   ├── Header.astro / Footer.astro
│   │   └── react/        # LiveQueue, BookingWizard, StatusPanel, AdminPanel
│   ├── layouts/BaseLayout.astro
│   ├── lib/
│   │   ├── util.ts       # helper & types (shared)
│   │   ├── api.ts        # client fetch ke /api/*
│   │   └── server/       # db.ts (D1+memory), auth.ts (HMAC), http.ts
│   ├── data/             # site.json, faq.json (single source of truth)
│   └── styles/global.css
├── migrations/0001_init.sql   # skema D1
├── .github/workflows/deploy.yml # CI/CD
├── wrangler.toml
└── docs/                 # PRD, panduan deploy, studi HTML, screenshot
```

## 🔐 Data & Secret

- **Data publik** (ganti sesuai klien): `src/data/site.json` — harga, jam, alamat, nomor WA, foto, tautan Maps. Cek dengan `npm run check:data`.
- **Secret admin** (jangan commit, set via `wrangler secret put` atau dashboard):
  - `ADMIN_PASSWORD` — password login `/admin`.
  - `ADMIN_SECRET` — kunci tanda tangan cookie (string acak 32+ karakter).
- `.dev.vars` (lokal) dan `.env*` sudah di-`.gitignore`.

## 📚 Dokumentasi

- [`docs/PRD-Pangkas-Rambut-Dodik.md`](docs/PRD-Pangkas-Rambut-Dodik.md) — Product Requirements Document lengkap.
- [`DEPLOY-GITHUB.md`](DEPLOY-GITHUB.md) — panduan deploy otomatis via GitHub.
- [`DEPLOY.md`](DEPLOY.md) — panduan deploy manual (CLI).
- [`docs/STUDI-HTML-Pangkas-Dodik.md`](docs/STUDI-HTML-Pangkas-Dodik.md) — studi HTML mentah.

## ✅ Alur Booking (ringkas)

1. Pelanggan pilih nomor (1–40) → isi nama & HP → konfirmasi.
2. Sistem simpan booking di D1 (jam slot = `06:30 + (nomor-1) × 15 menit`).
3. Pelanggan pantau status di `/status` (polling 20 dtk).
4. Pak Dodik di `/admin`: **Panggil Berikutnya / Lewati / Reset**, dan kirim WhatsApp follow-up ke pelanggan.

## 🧾 Catatan

- Proyek ini hasil konsultasi panjang (60 pesan) — transkrip & artefak riset ada di `.ds-fetch/`.
- Placeholder yang **wajib diisi sebelum produksi**: nomor WhatsApp, alamat lengkap, foto asli Dodik, dan `database_id` D1.