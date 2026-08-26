/** Uji penjaga hak cipta. Jalankan: npx --yes tsx scripts/test-jiplak.ts */
import { cekJiplakan, rentangTerpanjang } from '../lib/jiplak';

let gagal = 0;
const cek = (ok: boolean, label: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}`);
};

const ASLI =
  'KABAR BANTEN - Pemerintah Kabupaten Serang terus mendorong pengembangan kawasan wisata pesisir Anyer ' +
  'sebagai penopang perekonomian daerah. Kepala Dinas Pariwisata Kabupaten Serang menyatakan pihaknya ' +
  'menyiapkan penataan ulang kawasan pantai, penambahan fasilitas umum, serta pelatihan bagi pelaku usaha ' +
  'kecil di sekitar destinasi. Program tersebut menyasar sedikitnya lima desa pesisir yang selama ini menjadi ' +
  'tujuan utama wisatawan akhir pekan. Selain penataan fisik, pemerintah daerah juga menggandeng pengelola ' +
  'hotel dan restoran untuk menyusun paket wisata bersama yang diharapkan memperpanjang lama tinggal wisatawan.';

// Ringkasan asli dari Gemini (item 7) — verbatim terpanjangnya 9 kata, nama jabatan
const RINGKASAN_SAH =
  'Pemerintah Kabupaten Serang menyiapkan penataan kawasan pesisir Anyer untuk mendongkrak ekonomi daerah. ' +
  'Langkah itu mencakup perbaikan fasilitas umum dan pendampingan pelaku usaha kecil di lima desa pesisir. ' +
  'Kepala Dinas Pariwisata Kabupaten Serang menyebut pengelola hotel dan restoran turut dilibatkan menyusun ' +
  'paket bersama, dengan harapan wisatawan menginap lebih lama.';

console.log('  ── HARUS DIBLOKIR ──');
cek(!cekJiplakan(ASLI, ASLI).aman, 'artikel ditempel apa adanya');
cek(!cekJiplakan(ASLI.slice(0, Math.floor(ASLI.length * 0.8)), ASLI).aman, 'disalin 80% bagian awal');
cek(!cekJiplakan('Pengantar singkat. ' + ASLI, ASLI).aman, 'disalin utuh + kalimat pembuka tambahan');

console.log('\n  ── HARUS LOLOS ──');
cek(cekJiplakan(RINGKASAN_SAH, ASLI).aman, 'ringkasan sungguhan dari Gemini');
cek(cekJiplakan('', ASLI).aman, 'ringkasan kosong (belum diisi)');
cek(cekJiplakan(RINGKASAN_SAH, null).aman, 'tidak ada artikel pembanding');
cek(cekJiplakan('Ditulis sendiri oleh staff tanpa menyalin apa pun dari sumber mana pun.', ASLI).aman,
  'tulisan tangan staff');

console.log('\n  ── KUTIPAN SAH TIDAK BOLEH JADI ALARM PALSU ──');
// Kutipan pejabat 16 kata, berpetik + atribusi — persis kasus yang bikin alarm palsu.
const KUTIPAN = ASLI.slice(ASLI.indexOf('Kepala Dinas'), ASLI.indexOf('Program tersebut'));
const RINGKASAN_BERKUTIP =
  'Kawasan pesisir Anyer dibenahi Pemkab Serang tahun ini. "' + KUTIPAN.trim() + '" ujarnya. ' +
  'Langkah itu menyasar lima desa dan melibatkan pengelola penginapan setempat, ' +
  'dengan sasaran wisatawan tinggal lebih lama di kawasan tersebut.';
const berkutip = cekJiplakan(RINGKASAN_BERKUTIP, ASLI);
console.log(`  rentang ${berkutip.rentang} kata (isi kutipan dikecualikan)`);
cek(berkutip.aman, 'ringkasan dengan satu kutipan panjang berpetik tetap lolos');
cek(rentangTerpanjang(RINGKASAN_BERKUTIP, ASLI) < rentangTerpanjang(RINGKASAN_BERKUTIP.replace(/"/g, ''), ASLI),
  'tanpa petik, rentang yang sama terhitung lebih panjang');

console.log('\n  ── KUTIPAN PALSU HARUS TETAP TERHITUNG ──');
// Kasus nyata: kalimat NARASI wartawan disalin persis lalu diberi tanda kutip,
// tanpa siapa pun yang mengucapkannya. Tanpa syarat atribusi, ini terbaca 0.
const NARASI = ASLI.slice(ASLI.indexOf('Program tersebut'), ASLI.indexOf('Selain penataan'));
const PALSU = 'Pemkab Serang membenahi pesisir Anyer. "' + NARASI.trim() + '" Anggarannya belum diumumkan.';
const rentangPalsu = rentangTerpanjang(PALSU, ASLI);
console.log(`  kutipan tanpa atribusi → rentang ${rentangPalsu} kata`);
cek(rentangPalsu >= 8, 'salinan berpetik TANPA atribusi tetap terhitung');
cek(rentangTerpanjang(RINGKASAN_BERKUTIP, ASLI) === 0, 'salinan berpetik DENGAN atribusi tetap dikecualikan');

console.log('\n  ── LUBANG: MENGUTIP SEMUANYA ──');
const semuaDikutip = cekJiplakan('"' + ASLI + '"', ASLI);
cek(!semuaDikutip.aman, 'seluruh artikel di dalam tanda kutip TETAP diblokir');
console.log(`  alasan: ${semuaDikutip.alasan}`);
// Versi licik: dibungkus kutip DAN diberi atribusi supaya lolos pengecualian.
const semuaDikutipBeratribusi = cekJiplakan('Menurut laporan itu, "' + ASLI + '"', ASLI);
cek(!semuaDikutipBeratribusi.aman, 'dibungkus kutip + atribusi pun tetap diblokir (penjaga >50%)');
console.log(`  alasan: ${semuaDikutipBeratribusi.alasan}`);

console.log('\n  ── ANGKA ──');
const sah = cekJiplakan(RINGKASAN_SAH, ASLI);
const jiplak = cekJiplakan(ASLI, ASLI);
console.log(`  ringkasan sah  : rentang ${sah.rentang} kata, rasio ${sah.rasio.toFixed(2)}`);
console.log(`  jiplakan penuh : rentang ${jiplak.rentang} kata, rasio ${jiplak.rasio.toFixed(2)}`);
console.log(`  alasan         : ${jiplak.alasan}`);
cek(rentangTerpanjang(RINGKASAN_SAH, ASLI) < 25, `rentang ringkasan sah (${sah.rentang}) jauh di bawah ambang 25`);

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
