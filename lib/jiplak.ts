/**
 * Penjaga hak cipta.
 *
 * Aturan "jangan salin paragraf utuh" dikunci lewat prompt Gemini, tapi prompt
 * hanya berlaku kalau Gemini memang dipanggil. Jalur manual — user menempel isi
 * berita lalu teks itu berakhir di kolom Ringkasan tanpa pernah lewat Gemini —
 * melewati aturan itu sepenuhnya, dan PDF-nya jadi berisi artikel utuh milik
 * portal. Pemeriksaan ini menutup celah itu di sisi UI.
 */

const kata = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);

/**
 * Penanda atribusi ala jurnalistik Indonesia. Bentuk permukaannya didaftar
 * langsung — awalan me-N- mengubah huruf pertama kata dasar ("kata" →
 * "mengatakan"), jadi pencocokan kata dasar saja tidak menangkapnya.
 */
const ATRIBUSI =
  /\b(?:ujar|kata|menurut|tutur|jelas|ungkap|sebut|papar|tegas|imbuh|tambah|terang)(?:nya|kan)?\b|\b(?:mengatakan|menuturkan|menjelaskan|mengungkapkan|menyebut(?:kan)?|memaparkan|menegaskan)\b/i;

const JANGKAUAN = 60;   // atribusi selalu menempel kutipannya, tidak jauh-jauh

/**
 * Buang isi kutipan langsung dari RINGKASAN sebelum mengukur penyalinan.
 *
 * Aturan 5 di prompt memang mengizinkan satu kutipan berpetik. Kalau isinya ikut
 * dihitung, tiap kutipan sah jadi alarm palsu — terukur: kutipan pejabat 15 kata
 * dilaporkan sebagai penyalinan terpanjang padahal justru wajib apa adanya.
 *
 * TAPI hanya kutipan BERATRIBUSI yang dikecualikan. Tanpa syarat itu, model bisa
 * mencuci salinan dengan membungkusnya tanda kutip — terukur: satu kalimat narasi
 * wartawan disalin 15 kata persis lalu diberi tanda kutip tanpa ada yang
 * mengucapkannya, dan pengukuran melaporkannya sebagai 0.
 *
 * Hanya sisi ringkasan yang dibersihkan, bukan artikel aslinya: kalimat yang di
 * sumber berpetik lalu di ringkasan disalin TANPA petik tetap harus terhitung.
 * Petik tunggal sengaja tidak disentuh — bentrok dengan apostrof ("Qur'an").
 */
export function buangKutipan(s: string): string {
  const teks = s.replace(/[“”„«»]/g, '"');
  return teks.replace(/"[^"]*"/g, (kutipan, posisi: number) => {
    const sebelum = teks.slice(Math.max(0, posisi - JANGKAUAN), posisi);
    const sesudah = teks.slice(posisi + kutipan.length, posisi + kutipan.length + JANGKAUAN);
    return ATRIBUSI.test(sebelum) || ATRIBUSI.test(sesudah) ? ' ' : kutipan;
  });
}

/**
 * Panjang rangkaian kata berturut-turut terpanjang yang sama persis
 * antara ringkasan dan artikel asli.
 * ponytail: O(n·m) atas beberapa ratus kata — cukup cepat, tidak perlu suffix array.
 */
export function rentangTerpanjang(ringkasan: string, asli: string, benih = 8): number {
  const a = kata(buangKutipan(ringkasan));
  const b = kata(asli);
  if (a.length < benih || b.length < benih) return 0;

  const indeks = new Set<string>();
  for (let i = 0; i + benih <= b.length; i++) indeks.add(b.slice(i, i + benih).join(' '));

  let terpanjang = 0;
  let i = 0;
  while (i + benih <= a.length) {
    if (!indeks.has(a.slice(i, i + benih).join(' '))) { i++; continue; }
    let akhir = i + benih;
    while (akhir < a.length && indeks.has(a.slice(akhir - benih + 1, akhir + 1).join(' '))) akhir++;
    terpanjang = Math.max(terpanjang, akhir - i);
    i = akhir;
  }
  return terpanjang;
}

export type HasilJiplak = {
  aman: boolean;
  alasan: string | null;
  rentang: number;   // kata berturut-turut yang sama persis
  rasio: number;     // panjang ringkasan dibanding artikel asli
};

// Ringkasan sah dari Gemini terukur maksimal 9 kata berturut (nama jabatan,
// nama tempat). 25 memberi jarak lebar supaya tidak ada tuduhan palsu.
const BATAS_RENTANG = 25;
const BATAS_RENTANG_MIRIP = 12;
const BATAS_RASIO = 0.7;

export function cekJiplakan(ringkasan: string, asli: string | null): HasilJiplak {
  const r = (ringkasan ?? '').trim();
  if (!r || !asli?.trim()) return { aman: true, alasan: null, rentang: 0, rasio: 0 };

  const rentang = rentangTerpanjang(r, asli);
  const rasio = kata(r).length / Math.max(1, kata(asli).length);

  // Pemeriksaan di atas sengaja buta terhadap isi kutipan. Tanpa penjaga ini,
  // menempel seluruh artikel DI DALAM tanda kutip justru jadi jalan lolos.
  // Aturan 5 cuma mengizinkan satu kutipan pendek, jadi >50% tidak pernah sah.
  const porsiKutipan = 1 - kata(buangKutipan(r)).length / Math.max(1, kata(r).length);
  if (porsiKutipan > 0.5) {
    return { aman: false, rentang, rasio, alasan: 'Lebih dari separuh ringkasan berupa kutipan langsung — itu menyalin, bukan meringkas.' };
  }

  if (rentang >= BATAS_RENTANG) {
    return { aman: false, rentang, rasio, alasan: `Ringkasan menyalin ${rentang} kata berturut-turut dari artikel asli.` };
  }
  if (rasio >= BATAS_RASIO && rentang >= BATAS_RENTANG_MIRIP) {
    return { aman: false, rentang, rasio, alasan: 'Ringkasan hampir sama panjang dan sama isinya dengan artikel asli.' };
  }
  return { aman: true, alasan: null, rentang, rasio };
}
