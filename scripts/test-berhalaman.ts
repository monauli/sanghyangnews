/**
 * Uji berhalaman() — tidak menyentuh jaringan.
 *
 * Bagian pertama memakai HTML ASLI dari lima portal. Berkasnya sengaja TIDAK
 * ikut di Git (±750 KB HTML pihak ketiga) dan dilewati kalau tidak ada.
 * Untuk membuatnya lagi:
 *   curl -s -A "Mozilla/5.0 ... Chrome/131.0 Safari/537.36" <url> > scripts/.h-<nama>.html
 * dengan <url> dan <nama> dari daftar NYATA di bawah.
 *
 * Bagian kedua dan ketiga jalan tanpa berkas apa pun, dan sudah memuat
 * jebakan-jebakan yang terukur dari kelima portal itu.
 *
 * Jalankan: npx --yes tsx scripts/test-berhalaman.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { berhalaman } from '../lib/extractor';

let gagal = 0;
const cek = (ok: boolean, ket: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${ket}`);
};

// [berkas, url artikel, harusnya berhalaman?]
const NYATA: [string, string, boolean][] = [
  ['suaramerdeka', 'https://jatim.suaramerdeka.com/jatim/108817438281/pemkab-situbondo-dan-serang-sepakati-anyer-panarukan-3r-dorong-koridor-wisata-sejarah-dan-ekonomi', true],
  ['kabar6', 'https://kabar6.com/gunung-krakatau-siaga-pemkab-serang-pastikan-wisata-pantai-anyer-dan-cinangka-aman-dikunjungi/', false],
  ['satelitnews', 'https://www.satelitnews.com/161281/kunjungan-ke-anyer-cinangka-tembus-sebanyak-273-158-wisatawan/', false],
  ['biem', 'https://www.biem.co/read/2026/07/01/114728/exciting-banten-festival-2026-diserbu-pengunjung-anyer-dipadati-wisatawan/', false],
  ['detik', 'https://news.detik.com/berita/d-8567298/okupansi-hotel-di-banten-terdampak-usai-erupsi-gunung-anak-krakatau', false],
];

console.log('  ── HTML ASLI DARI PORTAL ──');
let adaBerkas = 0;
for (const [nama, url, harap] of NYATA) {
  const p = `scripts/.h-${nama}.html`;
  if (!existsSync(p)) {
    console.log(`  ⏭  ${nama} — ${p} belum ada, dilewati (lihat cara membuatnya di kepala berkas ini)`);
    continue;
  }
  adaBerkas++;
  const html = readFileSync(p, 'utf8');
  const dapat = berhalaman(html, url);
  cek(dapat === harap, `${nama.padEnd(13)} berhalaman=${dapat} (harap ${harap})`);
}
if (adaBerkas === 0) console.log('  (tidak ada berkas HTML tersimpan)');

console.log('\n  ── POLA BUATAN: HARUS TERDETEKSI ──');
const U = 'https://situs.test/berita/123/judul-berita';
for (const [html, ket] of [
  [`<a class="paging__link" href="${U}?page=2">2</a>`, '?page=2 mutlak'],
  [`<a href="/berita/123/judul-berita?page=3">3</a>`, '?page=3 relatif'],
  [`<a href="${U}/page/2">Selanjutnya</a>`, '/page/2'],
  [`<a href="${U}/2">2</a>`, '/2 di ujung'],
  [`<a href="${U}?id=9&page=2">2</a>`, 'page= bukan parameter pertama'],
] as [string, string][]) cek(berhalaman(html, U), ket);

console.log('\n  ── POLA BUATAN: TIDAK BOLEH TERDETEKSI ──');
for (const [html, ket] of [
  [`<a href="https://situs.test/berita/999/berita-lain" rel="next">Berita berikutnya</a>`, 'rel=next ke ARTIKEL LAIN (jebakan kabar6 & biem)'],
  [`<div class="jeg_pagination_nextprev"></div>`, 'nama kelas "pagination" milik modul tema (jebakan satelitnews)'],
  [`<a href="#" aria-label="View previous page posts">Sebelumnya</a>`, 'pager daftar berita'],
  [`<a href="${U}?page=1">1</a>`, 'page=1 — halaman ini sendiri, bukan bukti berhalaman'],
  [`<a href="https://situs.test/kategori/wisata?page=2">2</a>`, 'page=2 tapi di HALAMAN KATEGORI, bukan artikel ini'],
  [`<a href="${U}-lanjutan">Lanjutan</a>`, 'alamat mirip tapi bukan nomor halaman'],
  ['<p>Artikel biasa tanpa tautan apa pun.</p>', 'tanpa tautan'],
] as [string, string][]) cek(!berhalaman(html, U), ket);

console.log('\n  ── TIDAK MELEMPAR ──');
cek(berhalaman('<a href="::bukan-url::">x</a>', U) === false, 'href rusak diabaikan');
cek(berhalaman('<a href="?page=2">2</a>', 'bukan-url') === false, 'url artikel rusak → false, bukan lempar');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
