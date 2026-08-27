/**
 * Jembatan antara lib/* (server) dan halaman (client).
 * Isinya bentuk data yang dilihat UI + terjemahan istilah internal ke bahasa manusia.
 */
import type { ScoredArticle } from './scoring';
import { SCORE_TINGGI, SCORE_SEDANG } from '@/config/thresholds';

/**
 * Versi ramping ScoredArticle. `desc` dan `query` sengaja dibuang:
 * hasil pencarian bisa ~260 artikel dan sessionStorage cuma muat ~5 MB.
 */
export type UiArticle = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  sourceName: string;
  location: string;
  score: number;      // hanya untuk mengurutkan & mengelompokkan — JANGAN ditampilkan
  reasons: string[];
  hits: number;
  dupeOf: string | null;
};

/** Akhiran alamat situs, dibuang sebelum membandingkan nama media. */
const TLD = /\.(?:co|or|web|go|ac|my)?\.?(?:id|com|net|org|news|info|tv)$/i;
/** "memorandum.disway.id" — nama domain telanjang, tidak mungkin bagian judul berita. */
const MIRIP_DOMAIN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+\.[a-z]{2,}$/i;

const inti = (s: string) => s.toLowerCase().replace(TLD, '').replace(/[^a-z0-9]/g, '');

/** Sisakan judul yang masih bermakna — jangan sampai terkupas habis. */
const MIN_SISA = 20;
const MAKS_EKOR = 40;

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
 */
export function judulBersih(title: string, sourceName: string): string {
  let hasil = title.trim();
  const sumber = inti(sourceName);

  for (let putaran = 0; putaran < 3; putaran++) {
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

export const toUi = (a: ScoredArticle): UiArticle => ({
  id: a.id, title: judulBersih(a.title, a.sourceName), link: a.link, pubDate: a.pubDate,
  sourceName: a.sourceName, location: a.location, score: a.score,
  reasons: a.reasons, hits: a.hits, dupeOf: a.dupeOf,
});

/** Artikel terpilih yang dibawa ke halaman preview. */
export type ArtikelTerpilih = {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  pubDate: string;
  imageUrl: string | null;
};

export const KUNCI = {
  hasil: 'sanghyang:searchResult',
  pilihan: 'sanghyang:selected',
  tanggal: 'sanghyang:publishDate',
  gagal: 'sanghyang:failedQueries',
  periode: 'sanghyang:periode',      // "2026-07-01..2026-07-31" — rentang yang dicari user
} as const;

// ---------- BADGE ----------
/** Alasan positif saja. Yang negatif tidak perlu dijelaskan — artikelnya sudah tenggelam. */
const LABEL: [string, string][] = [
  ['🏖', '🏖 Wisata'],
  ['💰', '💰 Ekonomi'],
  ['🎪', '🎪 Acara'],
  ['🏛', '🏛 Pejabat'],
  ['✳️', '✳️ Banyak sumber'],
];

export function badge(reasons: string[]): string[] {
  const out: string[] = [];
  for (const [tanda, label] of LABEL) {
    if (reasons.some((r) => r.startsWith(tanda))) out.push(label);
  }
  return out.slice(0, 3);
}

// ---------- KELOMPOK ----------
export type Grup = 'utama' | 'lain' | 'kurang';

export const grupOf = (score: number): Grup =>
  score >= SCORE_TINGGI ? 'utama' : score >= SCORE_SEDANG ? 'lain' : 'kurang';

export const JUDUL_GRUP: Record<Grup, string> = {
  utama: '⭐ Berita Utama',
  lain: 'Berita Lain',
  kurang: 'Kurang Relevan',
};

// ---------- TANGGAL ----------
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', opts);

/** "Jumat, 26 Juni 2026" — dipakai header newsletter. */
export const tanggalPanjang = (ymd: string) =>
  ymd ? fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ymd + 'T00:00:00')) : '';

/** "26 Jun 2026" — dipakai di kartu review. */
export const tanggalPendek = (ymd: string) =>
  ymd ? fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ymd + 'T00:00:00')) : '';

/**
 * Periode berita untuk kop newsletter — BUKAN tanggal terbit.
 * Tanpa ini pembaca melihat "Rabu, 26 Agustus 2026" di atas berita bulan Juli
 * dan mengira beritanya basi.
 *
 *   1-31 Juli          → "Juli 2026"              (satu bulan penuh, cukup namanya)
 *   1-15 Juli          → "1 – 15 Juli 2026"       (bulan ditulis sekali)
 *   25 Juni - 10 Juli  → "25 Juni – 10 Juli 2026" (tahun ditulis sekali)
 *   lintas tahun       → kedua tanggal lengkap
 */
export function periodeEdisi(dari: string, sampai: string): string {
  if (!dari || !sampai) return '';
  const a = new Date(dari + 'T00:00:00');
  const b = new Date(sampai + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) return '';

  const lengkap = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
  if (dari === sampai) return lengkap.format(a);   // sehari saja, bukan "9 – 9 Juli"

  const bulanSama = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const hariTerakhir = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();

  if (bulanSama && a.getDate() === 1 && b.getDate() === hariTerakhir) {
    return fmt({ month: 'long', year: 'numeric' }).format(a);
  }
  if (bulanSama) return `${a.getDate()} – ${lengkap.format(b)}`;
  if (a.getFullYear() === b.getFullYear()) {
    return `${fmt({ day: 'numeric', month: 'long' }).format(a)} – ${lengkap.format(b)}`;
  }
  return `${lengkap.format(a)} – ${lengkap.format(b)}`;
}
