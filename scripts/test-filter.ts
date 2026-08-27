/**
 * Uji saringan lokasi "serang" + pengelompokan berita serupa.
 * Data buatan, tidak menyentuh jaringan.
 * Jalankan: npx --yes tsx scripts/test-filter.ts
 */
import { filterArticles } from '../lib/filter';
import { scoreArticles } from '../lib/scoring';
import type { RawArticle } from '../lib/googlenews';

let gagal = 0;
const cek = (ok: boolean, ket: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${ket}`);
};

let n = 0;
const art = (title: string, desc = ''): RawArticle => ({
  title, desc, link: `https://news.google.com/rss/articles/ID${++n}`,
  pubDate: '2026-07-15', sourceName: 'Uji', sourceUrl: 'https://uji.test', query: 'q',
});

const lolos = (title: string, desc = '') =>
  filterArticles([art(title, desc)]).articles.length === 1;

console.log('  ── "SERANG" HARUS LOLOS (kota/kabupaten di Banten) ──');
for (const [judul, ket] of [
  ['Kunjungan Wisata Kabupaten Serang Naik', 'kabupaten'],
  ['HUT ke-19 Kota Serang Libatkan UMKM', 'kota'],
  ['Bupati Serang Dorong Festival Ciomas Ngabring Jadi Agenda Tahunan', 'jabatan: bupati'],
  ['Pemkab Serang Siapkan Anggaran Wisata', 'pemkab'],
  ['DPRD Serang Bahas Retribusi Pariwisata', 'dprd'],
  ['Polres Serang Amankan Jalur Wisata', 'polres'],
  ['Bapenda Serang Sebut Pajak Hotel Naik', 'bapenda'],
  ['Dinas Pariwisata Serang Gelar Pelatihan', 'dinas …'],
  ['Kolosal Silat Meriahkan Festival Ngabring di Serang', '"di Serang" = keterangan tempat'],
  ['Jalan Tol Serang – Panimbang Seksi 2 Ditargetkan Beroperasi', 'ruas tol, pemisah en-dash'],
  ['Jalan Tol Serang-Panimbang Dibuka', 'ruas tol, pemisah hubung'],
  ['Wisata Serang Ramai', 'penguat di ringkasan: Banten'],
] as [string, string][]) {
  const desc = ket.includes('ringkasan') ? 'Kawasan pesisir Banten ramai pengunjung.' : '';
  cek(lolos(judul, desc), `${ket.padEnd(34)} | ${judul.slice(0, 52)}`);
}

console.log('\n  ── "SERANG" HARUS DIBUANG (kata kerja / bukan Banten) ──');
for (const [judul, ket] of [
  ['Israel Kembali Serang Gaza, Devisa Pariwisata Menguat', 'kata kerja: kembali serang'],
  ['Harga Minyak Naik Setelah AS dan Iran Saling Serang', 'kata kerja: saling serang'],
  ['Trump Ancam Serang Infrastruktur Iran', 'kata kerja: ancam serang'],
  ['Persib Rekrut Pemain Baru untuk Lini Serang', 'istilah bola: lini serang'],
  ['Kucing Oyen D Las Serang Resmi Tiba di Purbalingga', 'nama tempat lain'],
  ['Perpustakaan Nyi Ageng Serang Dibuka Lagi di Jakarta', 'nama tokoh, lokasi Jakarta'],
] as [string, string][]) {
  cek(!lolos(judul), `${ket.padEnd(34)} | ${judul.slice(0, 52)}`);
}

console.log('\n  ── LOKASI LAIN TIDAK TERPENGARUH ──');
for (const j of [
  'Wisata Pantai Anyer Ramai Pengunjung',
  'Hotel di Cilegon Penuh Saat Libur',
  'Pantai Carita Diserbu Wisatawan',
]) cek(lolos(j), j);
cek(!lolos('Wisata Pantai Kuta Bali Ramai'), 'tanpa kata lokasi Banten → dibuang');

console.log('\n  ── PENGELOMPOKAN BERITA SERUPA ──');
// A~B, B~C, tapi A dan C belum tentu mirip langsung: harus tetap SATU gugus.
const mirip = [
  art('Gunung Anak Krakatau Siaga, Wisata Pantai Anyer Dijamin Aman'),
  art('Gunung Anak Krakatau Siaga, Wisata Pantai Anyer Dinilai Aman'),
  art('Gunung Anak Krakatau Siaga, Pantai Anyer Dinilai Aman Dikunjungi'),
  art('Okupansi Hotel Anyer Turun Drastis Bulan Ini'),   // di luar gugus
];
const { articles } = filterArticles(mirip);
cek(articles.length === 4, 'keempatnya lolos saringan');
const g = articles.filter((a) => a.grupUkuran > 1);
cek(g.length === 3, `tiga berita serupa masuk satu gugus (dapat ${g.length})`);
cek(new Set(g.map((a) => a.dupeOf)).size === 1, 'ketiganya menunjuk akar gugus yang sama');
cek(articles.find((a) => /Okupansi/.test(a.title))!.grupUkuran === 1, 'berita berbeda tidak ikut tergabung');

const sc = scoreArticles(articles);
const anggota = sc.filter((a) => a.grupUkuran > 1);
const wakil = anggota.filter((a) => !a.dupeOf);
cek(wakil.length === 1, `tepat satu wakil (dapat ${wakil.length})`);
cek(wakil[0].score === Math.max(...anggota.map((a) => a.score)), 'wakil = skor tertinggi di gugus');
cek(anggota.every((a) => a.grupUkuran === 3), 'ukuran gugus tercatat sama di semua anggota');
cek(anggota.filter((a) => a.dupeOf).every((a) => a.dupeOf === wakil[0].id),
  'anggota non-wakil menunjuk ID wakil, bukan akar sementara');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
