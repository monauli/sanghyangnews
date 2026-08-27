/**
 * Jembatan antara lib/* (server) dan halaman (client).
 * Isinya bentuk data yang dilihat UI + terjemahan istilah internal ke bahasa manusia.
 */
import type { ScoredArticle } from './scoring';
import { SCORE_TINGGI, SCORE_SEDANG } from '@/config/thresholds';
import { judulBersih } from './judul';

// Dipakai luas oleh halaman & skrip uji lewat '@/lib/ui'; rumahnya lib/judul.ts.
export { judulBersih };

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
  dupeOf: string | null;   // ID wakil gugus; null = artikel ini wakilnya, atau tidak punya kembaran
  grupUkuran: number;      // banyak artikel dalam gugus, termasuk dirinya
};

export const toUi = (a: ScoredArticle): UiArticle => ({
  id: a.id, title: a.judul, link: a.link, pubDate: a.pubDate,
  sourceName: a.sourceName, location: a.location, score: a.score,
  reasons: a.reasons, hits: a.hits, dupeOf: a.dupeOf, grupUkuran: a.grupUkuran,
});

/**
 * Anggota gugus berita serupa yang benar-benar terlihat dalam SATU daftar.
 * Dipakai per grup tampilan, bukan atas seluruh korpus: badge yang menyebut 23
 * sementara di layar cuma ada 9 kartu membuat staf mengira aplikasinya salah.
 * Kunci gugus = ID wakil (dupeOf), atau ID sendiri kalau dia wakilnya.
 */
export function ukuranTampak(list: UiArticle[]): Map<string, number> {
  const kunci = (a: UiArticle) => a.dupeOf ?? a.id;
  const n = new Map<string, number>();
  for (const a of list) n.set(kunci(a), (n.get(kunci(a)) ?? 0) + 1);
  return new Map(list.map((a) => [a.id, n.get(kunci(a))!]));
}

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
