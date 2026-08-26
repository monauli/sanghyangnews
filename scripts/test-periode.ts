/** Uji format periode edisi. Jalankan: npx --yes tsx scripts/test-periode.ts */
import { periodeEdisi, tanggalPanjang } from '../lib/ui';

let gagal = 0;
const cek = (dari: string, sampai: string, harap: string, label: string) => {
  const keluar = periodeEdisi(dari, sampai);
  const ok = keluar === harap;
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label.padEnd(34)} → "${keluar}"${ok ? '' : `  (harap "${harap}")`}`);
};

console.log('  ── SATU BULAN PENUH → NAMA BULAN SAJA ──');
cek('2026-07-01', '2026-07-31', 'Juli 2026', '1-31 Juli (31 hari)');
cek('2026-06-01', '2026-06-30', 'Juni 2026', '1-30 Juni (30 hari)');
cek('2026-02-01', '2026-02-28', 'Februari 2026', 'Februari biasa (28 hari)');
cek('2028-02-01', '2028-02-29', 'Februari 2028', 'Februari kabisat (29 hari)');

console.log('\n  ── BUKAN SEBULAN PENUH → RENTANG LENGKAP ──');
cek('2026-07-01', '2026-07-15', '1 – 15 Juli 2026', 'separuh bulan');
cek('2026-07-02', '2026-07-31', '2 – 31 Juli 2026', 'mulai tanggal 2');
cek('2026-07-01', '2026-07-30', '1 – 30 Juli 2026', 'kurang sehari dari penuh');
cek('2026-06-25', '2026-07-10', '25 Juni – 10 Juli 2026', 'lintas bulan, tahun sama');
cek('2025-12-20', '2026-01-05', '20 Desember 2025 – 5 Januari 2026', 'lintas tahun');
cek('2026-07-09', '2026-07-09', '9 Juli 2026', 'satu hari saja');

console.log('\n  ── MASUKAN TIDAK BENAR → KOSONG (baris Edisi disembunyikan) ──');
cek('', '2026-07-31', '', 'tanggal awal kosong');
cek('2026-07-01', '', '', 'tanggal akhir kosong');
cek('bukan-tanggal', '2026-07-31', '', 'bukan tanggal');
cek('2026-07-31', '2026-07-01', '', 'terbalik (akhir sebelum awal)');

console.log('\n  ── TIDAK BOLEH ADA NAMA BULAN INGGRIS ──');
const semua = [
  periodeEdisi('2026-07-01', '2026-07-31'),
  periodeEdisi('2026-06-25', '2026-07-10'),
  periodeEdisi('2025-12-20', '2026-01-05'),
  tanggalPanjang('2026-08-26'),
].join(' | ');
const inggris = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/.exec(semua);
if (inggris) { gagal++; console.log(`  🔴 SALAH ada bulan Inggris: ${inggris[0]}`); }
else console.log(`  ✅ semua Bahasa Indonesia: ${semua}`);

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
