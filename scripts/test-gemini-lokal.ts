/**
 * Bagian lib/gemini.ts yang tidak perlu memanggil API — gratis, instan.
 * Jalankan: npx --yes tsx scripts/test-gemini-lokal.ts
 */
import { buangMarkdown, sanitize, jedaDari, pesanKuota } from '../lib/gemini';

let gagal = 0;
const cek = (masuk: string, harap: string, label: string) => {
  const keluar = buangMarkdown(masuk);
  const ok = keluar === harap;
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}`);
  if (!ok) console.log(`      masuk : ${JSON.stringify(masuk)}\n      keluar: ${JSON.stringify(keluar)}\n      harap : ${JSON.stringify(harap)}`);
};

console.log('  ── HARUS DIBERSIHKAN (kasus nyata dari Flash-Lite) ──');
cek('menyiapkan 40 *booth* produk kreatif', 'menyiapkan 40 booth produk kreatif', '*booth*');
cek('pembagian *doorprize* berupa sepeda motor', 'pembagian doorprize berupa sepeda motor', '*doorprize*');
cek('meliputi *infinity pool* tepi laut', 'meliputi infinity pool tepi laut', '*infinity pool* (dua kata)');
cek('serta *Seabreeze Golf & Bar* yang dilengkapi', 'serta Seabreeze Golf & Bar yang dilengkapi', '*teks dengan &*');
cek('**Pemerintah Provinsi Banten** menggelar', 'Pemerintah Provinsi Banten menggelar', '**tebal**');
cek('nilai _sangat penting_ bagi daerah', 'nilai sangat penting bagi daerah', '_miring_');
cek('anggaran __Rp312 miliar__ disiapkan', 'anggaran Rp312 miliar disiapkan', '__tebal__');
cek('istilah `okupansi` dipakai', 'istilah okupansi dipakai', '`kode`');
cek('## Ringkasan\nIsi paragraf.', 'Ringkasan\nIsi paragraf.', 'judul markdown');
cek('*booth* dan *doorprize* sekaligus', 'booth dan doorprize sekaligus', 'dua penanda satu baris');

console.log('\n  ── HARUS SELAMAT (bintang asli, bukan markdown) ──');
cek('Harga naik 3 * 4 kali lipat', 'Harga naik 3 * 4 kali lipat', 'bintang berspasi (perkalian)');
cek('Rating hotel ini 5* menurut penilaian', 'Rating hotel ini 5* menurut penilaian', 'bintang menempel angka (5*)');
cek('Catatan (*) di kaki artikel', 'Catatan (*) di kaki artikel', 'bintang tunggal dalam kurung');
cek('Diskon 20% * syarat berlaku', 'Diskon 20% * syarat berlaku', 'bintang sebagai penanda catatan');
cek('Hotel bintang 5 * * *', 'Hotel bintang 5 * * *', 'beberapa bintang berspasi');
cek('nama_file_penting disebut', 'nama_file_penting disebut', 'garis bawah di dalam kata');
cek('Paragraf satu.\n\nParagraf *dua* utuh.', 'Paragraf satu.\n\nParagraf dua utuh.', 'paragraf tetap terpisah');
cek('Bintang * di awal\nbaris * berikutnya', 'Bintang * di awal\nbaris * berikutnya', 'penanda tidak melintasi baris');
cek('Teks biasa tanpa penanda apa pun.', 'Teks biasa tanpa penanda apa pun.', 'teks polos tidak berubah');

console.log('\n  ── LEWAT sanitize() UTUH ──');
const hasil = sanitize('Berikut adalah ringkasannya.\nPanitia menyiapkan 40 *booth* produk kreatif.');
console.log(`  ✅ hasil : ${JSON.stringify(hasil.bersih)}`);
console.log(`  ✅ dibuang: ${JSON.stringify(hasil.dibuang)}`);
if (hasil.bersih !== 'Panitia menyiapkan 40 booth produk kreatif.') { gagal++; console.log('  🔴 SALAH'); }
if (hasil.dibuang.length !== 1) { gagal++; console.log('  🔴 SALAH: baris pengantar harus tetap tercatat dibuang'); }

console.log('\n  ── BACKOFF PAKAI retryDelay DARI GOOGLE ──');
const cekJeda = (ms: number, harap: number, label: string) => {
  const ok = ms === harap;
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label} → ${ms}ms${ok ? '' : ` (harap ${harap})`}`);
};
// Pesan asli yang benar-benar dikirim Google saat pengukuran kuota.
const P429 = (d: string) =>
  `{"error":{"code":429,"message":"You exceeded your current quota...","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"${d}"}]}}`;
cekJeda(jedaDari(P429('18.04979621s'), 0), 18550, 'retryDelay 18,0498 detik → dibulatkan ke atas + margin 500ms');
cekJeda(jedaDari(P429('8s'), 0), 8500, 'retryDelay 8 detik');
cekJeda(jedaDari(P429('23s'), 2), 23500, 'angka Google dipakai, bukan 2^percobaan');
cekJeda(jedaDari(P429('600s'), 0), 30000, 'retryDelay gila dibatasi 30 detik');
cekJeda(jedaDari('{"error":{"code":429,"message":"quota"}}', 0), 2000, 'tanpa retryDelay → cadangan 2 detik');
cekJeda(jedaDari('{"error":{"code":429,"message":"quota"}}', 1), 4000, 'tanpa retryDelay → cadangan 4 detik');

console.log('\n  ── PESAN KUOTA UNTUK STAF ──');
const cekPesan = (masuk: string, harap: string | undefined, label: string) => {
  const keluar = pesanKuota(masuk);
  const ok = keluar === harap;
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}\n      → ${keluar ?? '(tidak ada — pesan mentah tidak ditampilkan)'}`);
};
// Kedua pesan ini disalin dari respons Google yang sungguhan saat pengukuran.
const PER_MENIT = '{"error":{"code":429,"message":"...limit: 15, model: gemini-3.5-flash-lite","details":[{"@type":"...QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaValue":"15"}]}]}}';
const PER_HARI = '{"error":{"code":429,"message":"...limit: 500, model: gemini-3.5-flash-lite","details":[{"@type":"...QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaValue":"500"}]}]}}';
cekPesan(PER_MENIT, 'Gemini sedang sibuk, tunggu sebentar lalu coba lagi.', 'kuota per-menit');
cekPesan(PER_HARI, 'Jatah harian AI sudah habis. Coba lagi besok siang.', 'kuota harian');
cekPesan('GEMINI_API_KEY belum diisi', undefined, 'galat non-kuota tidak dapat pesan');
cekPesan('fetch failed', undefined, 'galat jaringan tidak dapat pesan');

const bocor = [PER_MENIT, PER_HARI].some((p) => /500|15|quotaId|429|gemini-3\.5/i.test(pesanKuota(p) ?? ''));
if (bocor) { gagal++; console.log('  🔴 SALAH angka kuota atau istilah teknis bocor ke staf'); }
else console.log('  ✅ tidak ada angka kuota / istilah teknis yang bocor');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
