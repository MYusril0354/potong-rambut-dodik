# Panduan Deploy Otomatis via GitHub (Cloudflare Workers + D1)

Alur: **push ke GitHub → GitHub Actions → build Astro → migrasi D1 → `wrangler deploy` → live di `*.workers.dev`**.

> Workflow sudah saya siapkan di `.github/workflows/deploy.yml`. Panduan ini menjelaskan cara memasang & menggunakannya.

---

## Ringkasan alur

```
GitHub (branch main) ──push──▶ GitHub Actions
                                   ├─ npm ci
                                   ├─ check:data (gate, main saja)
                                   ├─ npm run build (astro build)
                                   ├─ d1 migrations apply --remote (main saja)
                                   └─ wrangler deploy (main saja)
                                                 │
                                                 ▼
                                  Cloudflare Workers (workers.dev)
```

---

## 0. Prasyarat

- Repo GitHub (belum ada — lihat §A).
- Akun Cloudflare dengan akses token (§B).
- `database_id` D1 asli di `wrangler.toml` (§D).
- Data klien terisi di `src/data/site.json` (`npm run check:data` harus lolos, §D).

---

## A. Siapkan repo Git & push ke GitHub (sekali)

Repo belum ada `.git`-nya, jadi init dulu:

```sh
git init
git add .
git commit -m "Pangkas Rambut Dodik: Astro + Cloudflare Workers + D1"
```

Lalu buat repo kosong di GitHub (jangan centang "Initialize with README"), dan:

```sh
git remote add origin https://github.com/<USER>/<REPO>.git
git branch -M main
git push -u origin main
```

`.gitignore` sudah mengecualikan `node_modules/`, `dist/`, `.env*`, dan `.dev.vars` — jadi secret tidak akan ikut ter-commit.

---

## B. Buat API Token Cloudflare (sekali)

1. Cloudflare dashboard → **My Profile** (ikon orang) → **API Tokens** → **Create Token**.
2. Pilih template **"Edit Cloudflare Workers"**.
3. Atur **Account Resources** → akun Anda → **Continue** → **Create Token**.
4. **Salin token** (hanya tampil sekali).

Ambil juga Account ID:
- Dari dashboard → sidebar kanan bawah (di bawah nama akun), atau
- `npx wrangler whoami` → field **Account ID**.

---

## C. Set GitHub Secrets

Repo GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nama | Nilai |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token dari §B |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID dari §B |

> Catatan: `ADMIN_PASSWORD` & `ADMIN_SECRET` **tidak** perlu disimpan di GitHub. Keduanya set sekali di Cloudflare (dashboard → Worker → **Settings → Variables & Secrets → Secrets** atau `npx wrangler secret put`), dan akan persisten antar-deploy.

---

## D. D1 + isi data (sekali)

```sh
npm run d1:create        # buat DB, salin database_id
npm run d1:migrate       # terapkan skema (bisa juga dijalankan otomatis oleh workflow)
```

1. Salin `database_id` hasil `d1:create` ke `wrangler.toml` (ganti `REPLACE_WITH_D1_ID`).
2. Isi `src/data/site.json` (minimal `whatsapp`):
   ```sh
   npm run check:data     # pastikan HIJAU sebelum push ke main
   ```

> Penting: `check:data` **menggagalkan deploy** selama nomor WhatsApp masih placeholder. Ini sengaja, sesuai PRD.

---

## E. Workflow deploy (sudah dibuat)

File: `.github/workflows/deploy.yml`

| Trigger | Yang terjadi |
|---|---|
| `push` ke `main` | build → migrasi D1 → **deploy produksi** |
| `pull_request` ke `main` | **build saja** (CI check, tidak deploy) |
| `workflow_dispatch` | deploy manual dari tab Actions |

Alur di dalam workflow:
1. `npm ci` — install dependency.
2. `npm run check:data` — gate data (hanya `main`).
3. `npm run build` — build Astro (selalu, juga untuk validasi PR).
4. `wrangler d1 migrations apply --remote` — migrasi (hanya `main`).
5. `wrangler deploy` — via `cloudflare/wrangler-action` (hanya `main`).

---

## F. Verifikasi

1. Push perubahan ke `main`:
   ```sh
   git push origin main
   ```
2. Buka repo GitHub → tab **Actions** → lihat workflow berjalan sampai hijau.
3. Buka URL `https://pangkas-dodik.<SUBDOMAIN>.workers.dev` (URL tampil di log deploy).
4. Smoke test cepat:
   - `/` → landing tampil.
   - `/api/queue` → JSON status antrian.
   - `/admin` → login (password dari secret).

---

## G. Custom domain (opsional)

Cloudflare dashboard → **Workers & Pages** → project `pangkas-dodik` → **Settings → Domains & Routes → Add → Custom Domain**.

Lalu update `site` di `astro.config.mjs` dan `PUBLIC_SITE_URL` di `wrangler.toml` ke domain final, lalu push lagi.

---

## H. Rollback

- **Dashboard:** Workers & Pages → project → **Deployments** → pilih versi stabil → **Rollback**.
- **Via git:** revert commit di `main` lalu push → workflow deploy ulang versi lama.

Catatan: rollback kode **tidak** me-rollback skema D1. Migrasi DB bersifat aditif; jangan hapus kolom tabel di migrasi lama.

---

## I. Preview per Pull Request (opsional, belum aktif)

`cloudflare/wrangler-action` mendukung **deploy preview** untuk PR (komentar URL preview otomatis di PR). Untuk mengaktifkannya, ubah step deploy di workflow menjadi:

```yaml
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

(saat ini step deploy dibatasi `if: github.ref == 'refs/heads/main'`; hapus kondisi itu + aktifkan tabel `deployments` di `permissions` untuk mendapatkan preview URL di PR).

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Workflow gagal di `check:data` | Isi `site.json` (whatsapp), lalu `npm run check:data` |
| `wrangler deploy` error "database_id tidak valid" | `database_id` di `wrangler.toml` masih placeholder — jalankan `npm run d1:create` |
| Error 401 dari API di produksi | Secret `ADMIN_PASSWORD`/`ADMIN_SECRET` belum diset di Worker |
| Build gagal "node version" | Workflow pakai `node-version: 24`; pastikan `engines` cocok |