# Rincian Biaya & Ongkos Website "Pangkas Rambut Dodik"

Dokumen ini menjelaskan **berapa biaya** untuk menjalankan website/aplikasi antrian barbershop ini, supaya client (pemilik usaha) tahu persis apa yang gratis dan apa yang berbayar.

---

## Ringkasan (yang paling penting)

| Kategori | Biaya |
|---|---|
| **Biaya wajib bulanan** | **Rp 0** (GRATIS) |
| **Biaya opsional** (domain cantik) | **± Rp 100.000 – 300.000 / TAHUN** |

Artinya: website ini bisa jalan **selamanya tanpa biaya bulanan**. Hanya kalau ingin alamat yang lebih profesional (mis. `dodik.com`), cukup bayar domain sekali setahun.

---

## Rincian Layanan (semua ada paket gratis)

| Layanan | Dipakai untuk | Paket gratis | Cukup untuk barbershop? |
|---|---|---|---|
| **Cloudflare Workers** | Tempat aplikasi berjalan (server) | 100.000 request / hari | ✅ Jauh lebih dari cukup |
| **Cloudflare D1** | Database antrian & pengaturan | 5 GB penyimpanan, 5 juta baris dibaca / hari | ✅ Sangat cukup |
| **Cloudflare Turnstile** | Anti-bot/anti-spam form booking | Gratis, tak terbatas | ✅ |
| **Cloudflare Images** | Optimasi/kompresi foto | Gratis untuk volume kecil | ✅ |
| **GitHub** | Simpan kode + deploy otomatis | Gratis (repo public, menit Actions tanpa batas) | ✅ |
| **Alamat `.workers.dev`** | URL situs bawaan Cloudflare | Gratis | ✅ |

> Semua layanan di atas sepenuhnya gratis dan **tidak memerlukan kartu kredit** untuk paket dasar selama tetap dalam batas gratis.

---

## Kapan mulai BAYAR? (praktis tidak akan terjadi)

Biaya baru muncul **hanya jika** pemakaian melewati batas gratis. Untuk barbershop 1 kursi (± puluhan booking per hari), ini sangat mustahil terlewati:

- **Workers**: bayar mulai $5/bulan kalau melewati 10 juta request/bulan. Website ini butuh kurang dari 1% dari itu.
- **D1**: bayar kalau melewati 5 GB data / 5 juta baris-baca per hari. Sangat jauh dari terpakai.
- **GitHub Actions**: jika repo diubah ke *private*, gratis 2.000 menit/bulan (cukup untuk ratusan deploy). Public = tanpa batas.

**Kesimpulan:** pada pemakaian normal, **Rp 0 / bulan selamanya**.

---

## Biaya Opsional (HANYA jika client menginginkannya)

### 1. Domain custom (alamat cantik) — sekali bayar per tahun
| Jenis | Estimasi |
|---|---|
| `.my.id` (termurah, butuh KTP) | ± Rp 20.000 – 50.000 / tahun |
| `.id` | ± Rp 150.000 – 300.000 / tahun |
| `.com` | ± Rp 150.000 – 250.000 / tahun |

Manfaat: alamat lebih pendek & profesional (mis. `pangkasdodik.id`), bukan `pangkas-dodik.xxx.workers.dev`.

### 2. Fitur masa depan (belum dipakai, sebutkan sebagai catatan)
| Fitur | Estimasi biaya | Status |
|---|---|---|
| **Pembayaran QRIS** | ± 0,7% per transaksi (fee penyedia) | Belum diaktifkan |
| **WhatsApp Business API** (notifikasi otomatis *real*) | Per-percakapan (sesuai tarif Meta) | Belum dipakai — sekarang WA pakai cara gratis `wa.me` |

> Saat ini **notifikasi WhatsApp sudah GRATIS** (pakai `wa.me`, bukan API berbayar).

---

## Kesimpulan untuk Client

1. **Biaya operasional bulanan: Rp 0 (gratis).**
2. Satu-satunya biaya yang mungkin adalah **domain custom ± Rp 100–300 ribu per tahun** (opsional).
3. Tidak ada biaya tersembunyi, tidak ada biaya per-booking, tidak ada langganan wajib.

---

## Catatan (Disclaimer)
Harga di atas berdasarkan tarif publik Cloudflare, GitHub, dan registrar domain pada saat dokumen ini dibuat. Tarif dapat berubah sewaktu-waktu; silakan cek halaman pricing resmi masing-masing penyedia untuk angka terbaru.