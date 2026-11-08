# Skema Langganan (Subscription) — Website & Aplikasi Antrian "Pangkas Rambut Dodik"

> ⚠️ Semua angka adalah **SARAN**. Silakan ubah nominal paket, setup fee, dan ketentuan sesuai kesepakatan Anda dengan client.

---

## Pendahuluan

Model **langganan bulanan** memberi client akses penuh ke aplikasi antrian tanpa harus membayar besar sekali di awal. Biaya bulanan mencakup **hosting + perawatan + dukungan**, sehingga client tinggal pakai dan Anda mendapat **pemasukan berulang**.

---

## Paket Langganan

| Paket | Harga | Untuk siapa |
|---|---|---|
| **Basic** | **Rp 150.000 / bulan** | Barbershop kecil yang cukup pakai fitur inti |
| **Pro** | **Rp 300.000 / bulan** | Yang mau notifikasi WhatsApp otomatis + QRIS |
| **Custom** | Negosiasi | Multi cabang / multi barber |

---

## Rincian Tiap Paket

### ✅ Basic — Rp 150.000/bulan
- Landing page profesional + SEO (tampil di Google).
- Booking nomor antrian 3 langkah (anti-bot Turnstile).
- Halaman status live (tiket + grid) untuk pelanggan.
- Panel admin: panggil/lewati/reset antrian.
- Pengaturan jam & harga, total nomor, jam istirahat, tutup darurat.
- Pengingat WhatsApp via `wa.me` (GRATIS).
- Hosting Cloudflare (GRATIS).
- Dukungan via WhatsApp.

### ⭐ Pro — Rp 300.000/bulan
- Semua fitur Basic.
- **WhatsApp Business API**: notifikasi otomatis *real* (bukan hanya buka `wa.me`).
- **Pembayaran QRIS** di halaman status.
- Dukungan prioritas (respon lebih cepat).
- Pemantauan & pengecekan aplikasi berkala.

### 🏪 Custom — Negosiasi
- Multi cabang / multi barber.
- Fitur tambahan sesuai permintaan.

---

## Setup Fee (sekali di awal)

| Item | Harga saran |
|---|---|
| Pasang domain, konfigurasi, deploy, pelatihan pemakaian | **Rp 2.000.000** |

> Setup fee dibayar sekali sebelum aplikasi aktif. Setelah itu cukup bayar paket bulanan.

---

## Biaya Pihak Ketiga (bukan keuntungan Anda)

Penting agar transparan ke client — dijelaskan siapa yang menanggung:

| Biaya | Besaran | Ditanggung |
|---|---|---|
| **WhatsApp Business API** (Pro) | ± $25–100/bulan (tarif Meta, sesuai volume chat) | **Anda (developer)** — sudah diperhitungkan di harga Pro |
| **QRIS** (Pro) | ± 0,7% per transaksi | Dipotong dari pembayaran client |
| **Domain custom** | ± Rp 100–300 ribu / tahun | **Developer atau client** (dipisah, opsional) |
| **Hosting** | Rp 0 (free tier Cloudflare) | Gratis |

> Hosting inti **gratis**, sehingga margin bulanan Anda dari Basic/Pro sebagian besar adalah untung.

---

## Ketentuan Pembayaran (saran)

1. **Setup fee** dibayar lunas sebelum go-live.
2. **Langganan** dibayar di awal bulan (tanggal 1–5), berlaku 1 bulan kalender.
3. Terlambat > 7 hari → fitur boleh di-*pause* sementara hingga dibayar (opsional, sesuai kesepakatan).
4. Berhenti berlangganan → data client dapat diekspor/diberikan (file/riwayat) atas permintaan.

---

## Template Tagihan / Invoice Bulanan

```
══════════════════════════════════════
INVOICE LANGANAN — PANGKAS RAMBUT DODIK
══════════════════════════════════════
Periode           : 1 – 30 <Bulan> <Tahun>
Paket             : Basic / Pro
Biaya bulanan     : Rp 150.000
Domain (jika ada) : Rp -
──────────────────────────────────────
TOTAL             : Rp 150.000
──────────────────────────────────────
Jatuh tempo       : 5 <Bulan> <Tahun>
Pembayaran        : Transfer BCA/QRIS ...
══════════════════════════════════════
Terima kasih atas kepercayaan Anda 🙏
```

---

## Catatan

- Harga bisa disesuaikan tanpa mengubah fitur (mis. naik untuk client baru, tetap untuk client lama).
- Buat **kontrak/perjanjian tertulis** sederhana agar skema ini jelas kedua belah pihak.
- Untuk client yang keberatan bayar bulanan, tawarkan alternatif: **sekali bayar Rp 7.500.000** (lihat `PENAWARAN-HARGA.md`).