/**
 * Uji judulBersih() — tidak menyentuh jaringan.
 * Jalankan: npx --yes tsx scripts/test-judul.ts
 */
import { judulBersih } from '../lib/ui';

let gagal = 0;
const cek = (judul: string, sumber: string, harap: string, ket: string) => {
  const dapat = judulBersih(judul, sumber);
  const ok = dapat === harap;
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${ket}`);
  if (!ok) {
    console.log(`       masuk : ${JSON.stringify(judul)}`);
    console.log(`       dapat : ${JSON.stringify(dapat)}`);
    console.log(`       harap : ${JSON.stringify(harap)}`);
  }
};

console.log('  ── EKOR NAMA MEDIA HARUS DIBUANG ──');
cek(
  'Situbondo dan Serang Teken MoU Anyer-Panarukan 3R, Bangun Koridor Wisata Sejarah dan Ekonomi - Memorandum.co.id',
  'Memorandum.co.id',
  'Situbondo dan Serang Teken MoU Anyer-Panarukan 3R, Bangun Koridor Wisata Sejarah dan Ekonomi',
  'satu ekor biasa',
);
// Kasus yang lolos ke PDF dan memicu perbaikan ini.
cek(
  'Pemkab Situbondo dan Serang Sepakati Anyer-Panarukan 3R, Dorong Koridor Wisata Sejarah dan Ekonomi - Suara Merdeka Jatim - Suara Merdeka Jatim',
  'Suara Merdeka Jatim',
  'Pemkab Situbondo dan Serang Sepakati Anyer-Panarukan 3R, Dorong Koridor Wisata Sejarah dan Ekonomi',
  'DUA ekor sama persis (kasus Berita 5 di PDF)',
);
cek(
  'Situbondo dan Serang Teken MoU Anyer-Panarukan 3R, Bangun Koridor Wisata Sejarah dan Ekonomi - memorandum.disway.id - Memorandum.co.id',
  'Memorandum.co.id',
  'Situbondo dan Serang Teken MoU Anyer-Panarukan 3R, Bangun Koridor Wisata Sejarah dan Ekonomi',
  'ekor kedua beda tulisan (memorandum.disway.id vs Memorandum.co.id)',
);
cek(
  'Kunjungan Ke Anyer Cinangka Tembus Sebanyak 273.158 Wisatawan - satelitnews.com - SatelitNews',
  'SatelitNews',
  'Kunjungan Ke Anyer Cinangka Tembus Sebanyak 273.158 Wisatawan',
  'ekor kedua berupa domain telanjang',
);
cek(
  'Status Gunung Anak Krakatau naik, wisata ke Pantai Anyer dinilai aman - ANTARA',
  'ANTARA News Banten',
  'Status Gunung Anak Krakatau naik, wisata ke Pantai Anyer dinilai aman',
  'ekor lebih pendek dari sourceName (ANTARA vs ANTARA News Banten)',
);
cek(
  'Okupansi Hotel di Banten Terdampak Usai Erupsi Gunung Anak Krakatau - detiknews',
  'detikNews',
  'Okupansi Hotel di Banten Terdampak Usai Erupsi Gunung Anak Krakatau',
  'beda huruf besar-kecil',
);

console.log('\n  ── JUDUL BERTANDA HUBUNG HARUS TETAP UTUH ──');
cek(
  'Wisata Anyer - Carita Masih Aman, BPBD Minta Wisatawan Tetap Waspada - RRI.co.id',
  'RRI.co.id',
  'Wisata Anyer - Carita Masih Aman, BPBD Minta Wisatawan Tetap Waspada',
  'buang ekor media, "Anyer - Carita" di tengah selamat',
);
cek(
  'Krakatau Siaga, Ramai Pengunjung di Anyer - Carita',
  'Kabar6.com',
  'Krakatau Siaga, Ramai Pengunjung di Anyer - Carita',
  'judul BERAKHIR dengan "- Carita" — tidak boleh dipotong',
);
cek(
  'Pemkab Situbondo dan Serang Sepakati Anyer-Panarukan 3R',
  'Suara Merdeka Jatim',
  'Pemkab Situbondo dan Serang Sepakati Anyer-Panarukan 3R',
  '"Anyer-Panarukan 3R" tanpa spasi — tidak tersentuh',
);
cek(
  'Gunung Anak Krakatau Level III, Polres Cilegon Imbau Wisatawan - Faktabanten.co.id',
  'Faktabanten.co.id',
  'Gunung Anak Krakatau Level III, Polres Cilegon Imbau Wisatawan',
  'nama media memang berakhiran .co.id',
);
cek(
  'Jalur Anyer - Panarukan - Situbondo Dibuka Kembali',
  'ANTARA News Banten',
  'Jalur Anyer - Panarukan - Situbondo Dibuka Kembali',
  'TIGA tanda hubung, tidak ada yang mirip nama sumber',
);

console.log('\n  ── PENJAGA ──');
cek('Anyer - Carita', 'Carita', 'Anyer - Carita', 'judul pendek: sisa < 20 huruf, jangan dikupas habis');
cek(
  'Ini Judul Berita Yang Cukup Panjang - Kalimat Ekor Yang Terlalu Panjang Untuk Nama Media',
  'Kabar6.com',
  'Ini Judul Berita Yang Cukup Panjang - Kalimat Ekor Yang Terlalu Panjang Untuk Nama Media',
  'ekor > 40 huruf: bukan nama media',
);
cek('Berita Tanpa Ekor Sama Sekali Di Sini', 'Kabar6.com', 'Berita Tanpa Ekor Sama Sekali Di Sini', 'tanpa tanda hubung');
cek('  Judul Dengan Spasi Berlebih Di Ujung - Kabar6.com  ', 'Kabar6.com', 'Judul Dengan Spasi Berlebih Di Ujung', 'spasi berlebih dirapikan');
cek('Judul Berita Biasa Saja Di Sini - Kabar6.com', '', 'Judul Berita Biasa Saja Di Sini - Kabar6.com', 'sourceName kosong: jangan menebak');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
