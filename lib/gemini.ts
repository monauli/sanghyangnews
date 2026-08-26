/**
 * Ringkasan Bahasa Indonesia via Gemini (BACKEND.md §9).
 *
 * Prompt sudah direvisi sekali setelah baseline: aturan 1 dulu terlalu abstrak
 * (kalimat pembuka artikel tersalin 19 kata), dan target 120-180 kata yang
 * dipatok keras MEMAKSA Gemini mengarang saat artikel sumbernya pendek.
 */
import { GoogleGenAI } from '@google/genai';

/**
 * Bisa diganti dari dashboard tanpa deploy ulang — kuota free tier berbeda-beda
 * per model dan angkanya tidak cocok dengan dokumentasi resmi. Terukur sendiri:
 *   gemini-2.5-flash        20/hari, 10/menit
 *   gemini-3.5-flash-lite   15/menit  (kuotanya TERPISAH, bukan berbagi)
 *
 * Default BUKAN gemini-2.5-flash-lite: model itu masih terdaftar di /models tapi
 * generateContent membalas 404 "no longer available to new users", dan Google
 * sendiri mengarahkan ke gemini-3.5-flash-lite.
 *
 * Sengaja versi yang dipatok, bukan alias 'gemini-flash-lite-latest': promptnya
 * disetel ketat, jadi model tidak boleh berganti diam-diam di bawah kaki kita.
 */
export const model = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const MAX_TEXT = 8000;
const MIN_KATA_SUMBER = 300;   // di bawah ini, sumbernya terlalu tipis untuk diringkas

export type ArtikelUntukRingkas = { title: string; sourceName: string; fullText: string };

export type SummaryResult = {
  summary: string | null;
  error?: string;                // mentah, untuk log — JANGAN ditampilkan ke staf
  pesanUser?: string;            // sudah aman ditampilkan apa adanya
  targetKata: [number, number];  // target yang dikirim ke prompt, dihitung dari panjang artikel
  warnings: string[];            // 'artikel-pendek'
  dibuangSanitizer: string[];    // baris yang dipotong sanitizer — kalau terisi, aturan 6 gagal
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const jumlahKata = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Lapisan pengaman KEDUA setelah aturan 6 di prompt.
 * PDF referensi klien bocor kalimat "This translation preserves the original
 * meaning..." ke publikasi. Aturan di prompt saja terbukti tidak cukup.
 */
const POLA_BUANG = [
  'translation preserves',
  'ringkasan ini',
  'berikut adalah',
  'semoga membantu',
  'sebagai editor',
  'artikel di atas',
];

/**
 * Buang penanda markdown, sisakan teksnya.
 *
 * Flash-Lite memiringkan istilah asing sendiri (*booth*, *infinity pool*) padahal
 * tidak diminta. Template hanya meng-escape HTML, jadi tanda bintangnya bocor
 * mentah ke PDF.
 *
 * Syarat pasangan sengaja ketat supaya bintang yang memang bagian teks selamat:
 * penandanya harus mengapit teks tanpa spasi di sisi dalam ("2 * 3" dan "5*"
 * tidak tersentuh), dan isinya tidak boleh memuat baris baru.
 */
export function buangMarkdown(teks: string): string {
  return teks
    .replace(/\*\*(?!\s)([^*\n]*[^\s*])\*\*/g, '$1')   // **tebal**
    .replace(/(?<![*\w])\*(?!\s)([^*\n]*[^\s*])\*(?!\w)/g, '$1')
    .replace(/(?<![_\w])__(?!\s)([^_\n]*[^\s_])__(?!\w)/g, '$1')
    .replace(/(?<![_\w])_(?!\s)([^_\n]*[^\s_])_(?!\w)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '');               // judul markdown
}

export function sanitize(teks: string): { bersih: string; dibuang: string[] } {
  const dibuang: string[] = [];
  const baris = teks.split('\n').filter((b) => {
    const l = b.toLowerCase();
    if (POLA_BUANG.some((p) => l.includes(p))) { dibuang.push(b.trim()); return false; }
    return true;
  });
  return {
    bersih: buangMarkdown(baris.join('\n')).replace(/\n{3,}/g, '\n\n').trim(),
    dibuang,
  };
}

/**
 * Target 40-50% dari panjang artikel, dibatasi 60-180 kata.
 * Rentang dijaga minimal 20 kata supaya promptnya tidak jadi perintah mustahil.
 */
export function targetKata(kataSumber: number): [number, number] {
  const jepit = (n: number) => Math.min(180, Math.max(60, Math.round(n)));
  let lo = jepit(kataSumber * 0.4);
  let hi = jepit(kataSumber * 0.5);
  if (hi - lo < 20) hi = Math.min(180, lo + 20);
  if (hi - lo < 20) lo = Math.max(60, hi - 20);
  return [lo, hi];
}

function buatPrompt(a: ArtikelUntukRingkas, [lo, hi]: [number, number]): string {
  return `Kamu adalah editor newsletter internal Sanghyang Resort (Anyer, Banten).

Ringkas artikel berita berikut untuk newsletter internal.

ATURAN KERAS:
1. Tulis ulang sepenuhnya dengan kalimatmu sendiri. DILARANG menyalin
   kalimat utuh dari artikel asli.
   DILARANG memulai ringkasan dengan kalimat pembuka artikel asli —
   mulailah dari fakta yang menurutmu paling penting, bukan dari
   urutan artikel.
   Kalau satu rangkaian lebih dari 10 kata sama persis dengan artikel
   asli, susun ulang kalimat itu.
2. Panjang: ${lo}-${hi} kata, dibagi jadi 2-4 paragraf pendek.
3. Bahasa Indonesia formal-jurnalistik. Netral, tanpa opini.
4. Pertahankan fakta penting: nama orang, jabatan, angka, tanggal,
   nama tempat, nama institusi.
   Nama orang, jabatan resmi, nama institusi, nama produk, dan istilah
   teknis boleh ditulis persis seperti aslinya — itu bukan penyalinan.
5. Kutipan langsung boleh MAKSIMAL satu kalimat pendek.
6. JANGAN tulis pengantar, penutup, atau komentar tentang hasil
   ringkasanmu. Keluarkan HANYA teks ringkasan.
7. Pastikan ejaan nama institusi benar
   (contoh: "Satuan Polisi Pamong Praja (Satpol PP)").
8. JANGAN menambahkan informasi, penilaian, atau kalimat pemanis yang
   tidak ada di artikel asli. Kalau artikelnya pendek, ringkasannya
   juga pendek. Lebih baik singkat daripada mengarang.
   JANGAN menyimpulkan atau melengkapi informasi yang tidak tertulis di
   artikel. Kalau sumber hanya menulis "Minggu", tulis "Minggu" — jangan
   tambahkan tanggalnya. Kalau sumber tidak menyebut angka, jangan
   menghitungnya sendiri.
   JANGAN memperluas cakupan pernyataan sumber. Kalau sumber menulis
   "setiap tipe kamar", jangan tulis "seluruh kamar"; kalau sumber
   menulis "sebagian", jangan tulis "semua". Pertahankan persis sekuat
   apa yang sumber nyatakan, tidak lebih.

JUDUL: ${a.title}
SUMBER: ${a.sourceName}
ARTIKEL:
${a.fullText.slice(0, MAX_TEXT)}`;
}

let klien: GoogleGenAI | null = null;
function ai() {
  if (!klien) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY belum diisi');
    klien = new GoogleGenAI({ apiKey });
  }
  return klien;
}

/**
 * Berapa lama harus menunggu sebelum coba lagi.
 *
 * Angka mati 2 dan 4 detik tidak pernah cukup: retryDelay yang benar-benar
 * dikirim Google saat kena batas per-menit terukur 8-24 detik, jadi ketiga
 * percobaan habis sebelum kuotanya pulih. Pakai angka dari Google;
 * 2/4 detik cuma cadangan kalau responsnya tidak memuat retryDelay.
 */
export function jedaDari(pesan: string, percobaan: number): number {
  const m = pesan.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const saran = m ? Math.ceil(Number(m[1]) * 1000) + 500 : 2000 * 2 ** percobaan;
  return Math.min(saran, 30_000);
}

// maxDuration di Vercel 60 detik dan merangkum sendiri makan waktu.
const ANGGARAN_TUNGGU = 35_000;

/**
 * Terjemahan galat kuota untuk staf. Membedakan per-menit dari per-hari itu
 * wajib: jatah harian baru pulih tengah malam Pacific, jadi staf yang disuruh
 * "tunggu sebentar" akan menunggu sia-sia berjam-jam.
 *
 * Google mengirim retryDelay ~54 detik untuk kuota HARIAN sekalipun — angka itu
 * menyesatkan, jadi jangan diteruskan. quotaId yang dipercaya.
 * Mengembalikan undefined kalau galatnya bukan soal kuota; pesan mentah tidak
 * pernah boleh sampai ke staf.
 */
export function pesanKuota(galat: string): string | undefined {
  if (!/429|RESOURCE_EXHAUSTED|quota/i.test(galat)) return undefined;
  return /PerDay/i.test(galat)
    ? 'Jatah harian AI sudah habis. Coba lagi besok siang.'
    : 'Gemini sedang sibuk, tunggu sebentar lalu coba lagi.';
}

/** Tidak pernah melempar — kalau gagal, user tulis ringkasannya sendiri. */
export async function summarizeOne(a: ArtikelUntukRingkas): Promise<SummaryResult> {
  const kata = jumlahKata(a.fullText.slice(0, MAX_TEXT));
  const target = targetKata(kata);
  const warnings = kata < MIN_KATA_SUMBER ? ['artikel-pendek'] : [];
  const gagal = (error: string): SummaryResult =>
    ({ summary: null, error, pesanUser: pesanKuota(error), targetKata: target, warnings, dibuangSanitizer: [] });

  let menunggu = 0;
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    try {
      const res = await ai().models.generateContent({
        model: model(),
        contents: buatPrompt(a, target),
      });
      const teks = res.text?.trim();
      if (!teks) return gagal('jawaban kosong');

      const { bersih, dibuang } = sanitize(teks);
      return { summary: bersih || null, targetKata: target, warnings, dibuangSanitizer: dibuang };
    } catch (e) {
      const pesan = (e as Error).message ?? String(e);
      // Retry hanya untuk kehabisan kuota. Galat lain tidak akan sembuh dengan menunggu.
      if (!/429|RESOURCE_EXHAUSTED|quota/i.test(pesan) || percobaan === 2) return gagal(pesan);

      const jeda = jedaDari(pesan, percobaan);
      // Menunggu lebih lama dari sisa anggaran cuma menukar 429 dengan timeout 504
      // yang pesannya jauh lebih membingungkan buat staf.
      // Pesan mentah Google yang diteruskan, bukan karangan sendiri: quotaId di
      // dalamnya yang menentukan staf disuruh menunggu sebentar atau sampai besok.
      if (menunggu + jeda > ANGGARAN_TUNGGU) return gagal(pesan);
      menunggu += jeda;
      await sleep(jeda);
    }
  }
  return gagal('gagal setelah 3 percobaan');
}

/** Sekuensial — hormati limit RPM free tier. Volume normal ~5 panggilan per newsletter. */
export async function summarizeMany(list: ArtikelUntukRingkas[]): Promise<SummaryResult[]> {
  const out: SummaryResult[] = [];
  for (const a of list) out.push(await summarizeOne(a));
  return out;
}
