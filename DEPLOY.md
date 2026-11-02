# Deploy — Pangkas Rambut Dodik

Panduan deploy ke **Cloudflare Workers + Pages + D1** (free tier, Rp 0/bulan).

## Prasyarat
- Akun Cloudflare (free tier cukup).
- Node.js ≥ 20 (wrld tersedia sebagai devDependency).
- Data klien lengkap di `src/data/site.json`.

## 1. Isi data klien
Edit `src/data/site.json`:

| Field | Isi |
|---|---|
| `whatsapp` | Nomor WA format internasional tanpa `+` (mis. `6281234567890`) |
| `address` | Alamat lengkap (jalan, desa/kecamatan, patokan) |
| `mapsEmbedUrl` | URL embed Google Maps (opsional; tanpa ini pakai fallback pencarian) |
| `heroImage` / `barberPhoto` | Foto asli Dodik (ganti dari placeholder Unsplash) |
| `phone` | Nomor telepon untuk tombol `tel:` (opsional) |

Cek kelengkapan (WA placeholder wajib lolos):

```sh
npm run check:data
```

## 2. Login Cloudflare (sekali)
```sh
npx wrangler login
```

## 3. Set secret admin
```sh
npx wrangler secret put ADMIN_PASSWORD   # masukkan password admin (bukan "dodik")
npx wrangler secret put ADMIN_SECRET     # string acak 32+ karakter
```

## 4. Buat database D1
```sh
npx wrangler d1 create pangkas-dodik-db
```
Salin `database_id` hasilnya ke `wrangler.toml` (ganti `REPLACE_WITH_D1_ID`).

## 5. Terapkan migrasi skema
```sh
npm run d1:migrate
```

## 6. Deploy
```sh
npm run deploy          # = check:data → build → wrangler deploy
```

Custom domain: Cloudflare dashboard → Workers & Pages → project → **Custom Domains**.

## Deploy otomatis via GitHub (opsional)
1. Push repo ke GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build command `npm run build`, output directory `dist`.
4. Pastikan binding D1 `DB` dan secrets (`ADMIN_PASSWORD`, `ADMIN_SECRET`) terpasang di dashboard.

## Rollback
- Dashboard → **Deployments** → pilih versi stabil → **Rollback**, atau
- `npx wrangler rollback`

## Keamanan
- `.dev.vars` dan `.env*` sudah di-`.gitignore` — jangan pernah commit.
- `ADMIN_SECRET` & `ADMIN_PASSWORD` hanya lewat `wrangler secret put`.