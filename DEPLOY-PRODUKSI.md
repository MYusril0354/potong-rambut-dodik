# Panduan Deploy Produksi (Go-Live)

Ceklis langkah demi langkah untuk membuat aplikasi **Pangkas Rambut Dodik** live di Cloudflare Workers + D1.

---

## Prasyarat (sekali saja)

1. **Akun Cloudflare yang benar** (bukan akun lama — penting, karena database D1 ada di akun baru Anda).
2. **D1 database `pangkas-dodik-db`** — ✅ sudah di-set ID-nya di `wrangler.toml` (`9eac766f-…`).
3. **Turnstile widget** — buat di dashboard Cloudflare → **Turnstile → Add widget** (hostname = domain Anda). Catat **Site Key** & **Secret Key**.
   - Jika belum punya, captcha tetap tampil tapi pakai *test key* ("always passes") → **tidak memblokir bot sungguhan**. Wajib pakai key asli untuk produksi.

---

## Langkah 0 — Ganti URL placeholder (WAJIB)

Ada 2 tempat yang masih `pangkas-dodik.example`. Ganti dengan URL asli Anda (mis. `https://pangkas-dodik.<subdomain>.workers.dev` atau domain custom):

1. `astro.config.mjs` → `site: 'https://…'`
2. `wrangler.toml` → `[vars] PUBLIC_SITE_URL = "https://…"`

> Efek kalau dibiarkan `.example`: canonical/OG/JSON-LD/sitemap mengarah ke domain palsu.

---

## Langkah 1 — Set secret di Cloudflare (produksi)

`.dev.vars` HANYA untuk lokal. Untuk produksi, set di Cloudflare (salah satu cara):

**Cara A — CLI:**
```sh
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```
(Masing-masing akan meminta input nilai; bisa juga `echo "nilai" | npx wrangler secret put NAMA`.)

**Cara B — Dashboard:** Workers & Pages → pilih `pangkas-dodik` → Settings → Variables & Secrets → Secrets → Add.

| Secret | Isi |
|---|---|
| `ADMIN_PASSWORD` | Password login `/admin` |
| `ADMIN_SECRET` | String acak 32+ karakter (tanda tangan cookie) |
| `TURNSTILE_SECRET_KEY` | Secret key Turnstile asli |

> ⚠️ `ADMIN_SECRET` bisa dibuat acak: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.

---

## Langkah 2 — Set `PUBLIC_TURNSTILE_SITE_KEY` (waktu build)

Site key Turnstile dibaca saat **build** (halaman `/book` di-prerender). Di GitHub:

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Nama: `PUBLIC_TURNSTILE_SITE_KEY`, nilai: site key Turnstile asli.
3. (Sudah saya wire — `deploy.yml` otomatis meng-export secret ini ke langkah build.)

---

## Langkah 3 — Set GitHub Actions secrets

1. Repo → **Settings → Secrets and variables → Actions**.
2. Tambahkan:

| Secret | Cara dapat |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard Cloudflare → kanan halaman (Account ID) |
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"** (pastikan dapat mengakses **D1: Edit** + **Workers Scripts: Edit**) |

---

## Langkah 4 — Deploy

**Otomatis (disarankan):** tinggal `git push` ke branch `main` → GitHub Actions akan build + terapkan migrasi D1 + deploy.

**Manual:** dari komputer Anda:
```sh
npm run deploy
# = check data klien -> build -> wrangler deploy
```
(Pastikan CLI wrangler sudah login ke akun Cloudflare yang benar: `npx wrangler whoami`.)

---

## Langkah 5 — Verifikasi

1. Buka URL produksi (`https://pangkas-dodik.<subdomain>.workers.dev`).
2. Landing tampil normal (jam, harga, FAQ, ikon).
3. Booking: pilih nomor → isi nama/HP → captcha → masuk.
4. Admin: `/admin` → login dengan `ADMIN_PASSWORD` → cek "Daftar Booking" muncul.
5. Konfirmasi data benar-benar tersimpan di D1 (restart/refresh → antrian tetap).

---

## Ringkasan secret (sekali lihat)

| Tempat | Kunci | Nilai |
|---|---|---|
| Cloudflare secret | `ADMIN_PASSWORD` | password admin |
| Cloudflare secret | `ADMIN_SECRET` | string acak 32+ |
| Cloudflare secret | `TURNSTILE_SECRET_KEY` | secret Turnstile |
| GitHub Actions secret | `PUBLIC_TURNSTILE_SITE_KEY` | site key Turnstile |
| GitHub Actions secret | `CLOUDFLARE_ACCOUNT_ID` | account id |
| GitHub Actions secret | `CLOUDFLARE_API_TOKEN` | API token (Workers+D1 edit) |

> `.dev.vars` **jangan** di-commit/di-push (sudah di `.gitignore`). Ia hanya untuk `npm run dev` lokal.