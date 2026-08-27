/**
 * Pembersih judul RSS Google. Berkas sendiri, bukan di lib/ui.ts, karena
 * lib/filter.ts memakainya juga dan lib/ui.ts mengimpor lib/scoring.ts →
 * lib/filter.ts — kalau ditaruh di ui.ts, impornya melingkar.
 */

/** Akhiran alamat situs, dibuang sebelum membandingkan nama media. */
const TLD = /\.(?:co|or|web|go|ac|my)?\.?(?:id|com|net|org|news|info|tv)$/i;
/** "memorandum.disway.id" — nama domain telanjang, tidak mungkin bagian judul berita. */
const MIRIP_DOMAIN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+\.[a-z]{2,}$/i;

const inti = (s: string) => s.toLowerCase().replace(TLD, '').replace(/[^a-z0-9]/g, '');

/** Sisakan judul yang masih bermakna — jangan sampai terkupas habis. */
const MIN_SISA = 20;
const MAKS_EKOR = 40;

/** Semua posisi " - " di dalam s, dari kiri ke kanan. */
function titikPotong(s: string): number[] {
  const out: number[] = [];
  for (let i = s.indexOf(' - '); i >= 0; i = s.indexOf(' - ', i + 1)) out.push(i);
  return out;
}

/**
 * Judul RSS Google selalu berakhiran " - NamaSumber".
 *
 * Yang dulu terlewat: sebagian portal SUDAH menempelkan nama situsnya sendiri
 * sebelum Google menempelkan miliknya, jadi ekornya ada dua berurutan —
 * "…dan Ekonomi - memorandum.disway.id - Memorandum.co.id". Memotong sekali
 * menyisakan yang pertama, dan itu yang tercetak di PDF. Terukur: 3 dari 10
 * judul pada satu peristiwa. Karena itu dikupas BERULANG.
 *
 * Ekor kedua belum tentu ditulis sama persis dengan sourceName, jadi
 * pencocokannya dilonggarkan: huruf besar-kecil, tanda baca, dan akhiran
 * alamat diabaikan, dan salah satu boleh jadi awalan yang lain
 * ("Suara Merdeka" vs "Suara Merdeka Jatim").
 *
 * Yang menjaga supaya judul bertanda hubung tidak ikut terpotong: ekornya
 * WAJIB berhubungan dengan nama sumbernya, atau berupa nama domain telanjang.
 * "Wisata Anyer - Carita Masih Aman - RRI.co.id" kehilangan "- RRI.co.id"
 * saja; "Carita" tidak mirip nama sumber mana pun, jadi aman.
 *
 * Huruf besar-kecil DIPERTAHANKAN — hasilnya dipakai untuk tampilan dan PDF.
 * Yang butuh bentuk banding tinggal membungkusnya dengan norm().
 */
export function judulBersih(title: string, sourceName: string): string {
  let hasil = title.trim();
  const sumber = inti(sourceName);

  for (let putaran = 0; putaran < 3; putaran++) {
    // Nama sumbernya sendiri bisa memuat " - " ("Bisnis.com - Ekonomi",
    // "PKS - Partai Keadilan Sejahtera"). Memotong di " - " TERAKHIR cuma
    // membuang "Ekonomi" dan menyisakan "- Bisnis.com" di judul — dan kata
    // "partai" yang tertinggal begitu pernah membuang beritanya lewat
    // BLACKLIST. Ekor yang PERSIS sama dengan nama sumber dipotong utuh,
    // tanpa batas panjang: kecocokan penuh sudah bukti yang cukup.
    const pas = sumber
      ? titikPotong(hasil).find((i) => i >= MIN_SISA && inti(hasil.slice(i + 3)) === sumber)
      : undefined;
    if (pas !== undefined) { hasil = hasil.slice(0, pas).trim(); continue; }

    const potong = hasil.lastIndexOf(' - ');
    if (potong < MIN_SISA) break;

    const ekor = hasil.slice(potong + 3).trim();
    if (!ekor || ekor.length > MAKS_EKOR || ekor.split(/\s+/).length > 5) break;

    const e = inti(ekor);
    const sama = !!e && !!sumber && (e === sumber || e.startsWith(sumber) || sumber.startsWith(e));
    if (!sama && !MIRIP_DOMAIN.test(ekor)) break;

    hasil = hasil.slice(0, potong).trim();
  }
  return hasil;
}
