/** Uji penjaga SSRF. Jalankan: npx --yes tsx scripts/test-urlaman.ts */
import { urlAman } from '../lib/urlaman';

const HARUS_DITOLAK = [
  'http://169.254.169.254/latest/meta-data/',   // metadata cloud
  'http://localhost:3000/api/export',
  'http://127.0.0.1:8080/',
  'http://10.0.0.5/rahasia',
  'http://192.168.1.1/admin',
  'http://172.16.0.1/',
  'http://172.31.255.255/',
  'http://0.0.0.0/',
  'http://[::1]/',
  'http://printer.local/',
  'http://db.internal/',
  'file:///C:/Windows/win.ini',
  'ftp://contoh.com/berkas',
  'javascript:alert(1)',
  'data:text/html,<script>',
  'bukan-url-sama-sekali',
  '',
  null,
  123,
];

const HARUS_DITERIMA = [
  'https://ketik.com/serang/berita',
  'https://travel.detik.com/travel-news/d-8552848/judul',
  'http://mediabanten.com/artikel',
  'https://ketik-assets.s3-id-jkt.icdn.id/gambar.jpg',
  'https://news.google.com/rss/articles/CBMi...',
  'https://172.15.0.1/',      // di LUAR rentang privat 172.16-31
  'https://11.0.0.1/',        // 11.x bukan privat
];

let gagal = 0;

console.log('  ── HARUS DITOLAK ──');
for (const u of HARUS_DITOLAK) {
  const ok = !urlAman(u);
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 LOLOS!'} ${String(u).slice(0, 52) || '(kosong)'}`);
}

console.log('\n  ── HARUS DITERIMA ──');
for (const u of HARUS_DITERIMA) {
  const ok = urlAman(u);
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 IKUT TERBLOKIR!'} ${u.slice(0, 52)}`);
}

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
