/**
 * Ringkasan Bahasa Indonesia via Gemini (BACKEND.md §9).
 *
 * Prompt sudah direvisi sekali setelah baseline: aturan 1 dulu terlalu abstrak
 * (kalimat pembuka artikel tersalin 19 kata), dan target 120-180 kata yang
 * dipatok keras MEMAKSA Gemini mengarang saat artikel sumbernya pendek.
 */
import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';
const MAX_TEXT = 8000;
const MIN_KATA_SUMBER = 300;   // di bawah ini, sumbernya terlalu tipis untuk diringkas

export type ArtikelUntukRingkas = { title: string; sourceName: string; fullText: string };

export type SummaryResult = {
  summary: string | null;
  error?: string;
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

export function sanitize(teks: string): { bersih: string; dibuang: string[] } {
  const dibuang: string[] = [];
  const baris = teks.split('\n').filter((b) => {
    const l = b.toLowerCase();
    if (POLA_BUANG.some((p) => l.includes(p))) { dibuang.push(b.trim()); return false; }
    return true;
  });
  return { bersih: baris.join('\n').replace(/\n{3,}/g, '\n\n').trim(), dibuang };
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

/** Tidak pernah melempar — kalau gagal, user tulis ringkasannya sendiri. */
export async function summarizeOne(a: ArtikelUntukRingkas): Promise<SummaryResult> {
  const kata = jumlahKata(a.fullText.slice(0, MAX_TEXT));
  const target = targetKata(kata);
  const warnings = kata < MIN_KATA_SUMBER ? ['artikel-pendek'] : [];
  const gagal = (error: string): SummaryResult =>
    ({ summary: null, error, targetKata: target, warnings, dibuangSanitizer: [] });

  for (let percobaan = 0; percobaan < 3; percobaan++) {
    try {
      const res = await ai().models.generateContent({
        model: MODEL,
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
      await sleep(2000 * 2 ** percobaan);   // 2 detik, lalu 4 detik
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
