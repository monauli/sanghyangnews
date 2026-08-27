/**
 * Uji saringan lokasi "serang" + pengelompokan berita serupa.
 * Data buatan, tidak menyentuh jaringan.
 * Jalankan: npx --yes tsx scripts/test-filter.ts
 */
import { filterArticles } from '../lib/filter';
import { scoreArticles } from '../lib/scoring';
import { ukuranTampak, type UiArticle } from '../lib/ui';
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

console.log('\n  ── NAMA MEDIA TIDAK BOLEH MELOLOSKAN APA PUN ──');
// Google RSS menempelkan " - NamaSumber" ke dalam judul. Kalau nama itu ikut
// dibandingkan, media Banten mana pun memuat kata "banten" dan meloloskan
// berita luar negeri: artikel yang sama lolos dari Radar Banten, dibuang dari
// CNN. Ini yang paling sering dipakai Sanghyang, jadi wajib dijaga di sini.
const rss = (judul: string, sumber: string, desc = ''): RawArticle =>
  ({ ...art(`${judul} - ${sumber}`, desc), sourceName: sumber });
for (const [judul, sumber] of [
  ['Israel Kembali Serang Wilayah Gaza Utara', 'Radar Banten'],
  ['Iran dan AS Saling Serang, Harga Minyak Melonjak', 'Kabar Banten'],
  ['Persib Perkuat Lini Serang Jelang Musim Baru', 'Banten Raya'],
  ['Kucing Oyen D Las Serang Resmi Tiba di Purbalingga', 'Banten Hay'],
] as [string, string][]) {
  cek(filterArticles([rss(judul, sumber)]).articles.length === 0,
    `[${sumber.padEnd(12)}] ${judul.slice(0, 44)}`);
}
// Ekor ganda: portal menempel namanya sendiri, lalu Google menempel lagi.
cek(filterArticles([rss('HUT ke-19 Kota Serang Libatkan UMKM - tangerangekspres.disway.id', 'Radar Banten')])
  .articles.length === 1, 'ekor ganda dikupas habis → tidak lagi kena REGIONAL_BLACKLIST "tangerang"');
// Nama media tidak boleh menyumbang skor tema.
{
  const skor = (sumber: string) => scoreArticles(
    filterArticles([rss('Bupati Serang Tinjau Jalan Rusak', sumber, 'Kegiatan di Banten.')]).articles)[0]?.score;
  cek(skor('Banten Wisata') === skor('Kabar Banten'),
    `skor tidak bergantung nama media (${skor('Banten Wisata')} vs ${skor('Kabar Banten')})`);
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

console.log('\n  ── HITUNGAN GUGUS DIBATASI KE YANG TERLIHAT ──');
// Satu gugus 4 artikel, tapi hanya 2 yang tampil di grup ini.
const ui = (id: string, dupeOf: string | null): UiArticle => ({
  id, title: id, link: '', pubDate: '', sourceName: '', location: '',
  score: 0, reasons: [], hits: 1, dupeOf, grupUkuran: 4,
});
const utama = [ui('w', null), ui('b1', 'w')];              // wakil + 1 anggota
const lain = [ui('b2', 'w'), ui('b3', 'w'), ui('sendiri', null)];
const mUtama = ukuranTampak(utama);
const mLain = ukuranTampak(lain);
cek(mUtama.get('w') === 2, `wakil dihitung 2 (yang terlihat), bukan 4 (dapat ${mUtama.get('w')})`);
cek(mUtama.get('b1') === 2, 'anggota di grup yang sama ikut angka yang sama');
cek(mLain.get('b2') === 2, `dua anggota di grup lain dihitung 2 (dapat ${mLain.get('b2')})`);
cek(mLain.get('sendiri') === 1, 'artikel tanpa kembaran tetap 1 → badge tidak muncul');
cek(ukuranTampak([ui('x', 'w')]).get('x') === 1, 'anggota sendirian di grupnya → 1, badge hilang');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
