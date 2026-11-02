// Validasi data klien sebelum deploy. Jalankan: node scripts/check-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const site = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/site.json', import.meta.url)), 'utf8'));

let fail = false;
const err = (m) => { fail = true; console.error('✗ ' + m); };
const warn = (m) => console.warn('⚠ ' + m);

// WAJIB (gagalkan build/deploy jika masih placeholder)
if (!site.whatsapp || /X{2,}|0{5,}/i.test(site.whatsapp)) {
  err(`"whatsapp" masih placeholder: "${site.whatsapp}" → isi nomor WA format internasional (mis. 6281234567890)`);
}

// PERINGATAN (tidak menggagalkan, tapi disarankan diisi)
if (!site.address || site.address === 'Pandaan, Kabupaten Pasuruan') {
  warn('"address" masih alamat parsial — isi jalan/desa/patokan lengkap untuk SEO & footer');
}
if (!site.mapsEmbedUrl) {
  warn('"mapsEmbedUrl" kosong — akan pakai fallback link pencarian Google Maps');
}
if (!site.phone) {
  warn('"phone" kosong (opsional) — nomor telepon untuk tombol tel:');
}
if (/unsplash\.com/i.test(site.heroImage || '')) {
  warn('"heroImage" masih foto placeholder Unsplash — ganti foto asli Dodik');
}
if (/unsplash\.com/i.test(site.barberPhoto || '')) {
  warn('"barberPhoto" masih foto placeholder Unsplash — ganti foto asli Dodik');
}

if (fail) {
  console.log('\n>> Lengkapi data di src/data/site.json, lalu jalankan ulang.');
  process.exit(1);
}
console.log('✓ Data klien siap untuk deploy.');
process.exit(0);