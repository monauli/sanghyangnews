/**
 * Skoring berbasis TEMA (BACKEND.md §7). Bobot & daftar kata dari config/keywords.ts.
 * Prinsip: yang menentukan relevansi adalah tema, bukan ada-tidaknya pejabat.
 */
import {
  W_WISATA, W_EKONOMI, W_ACARA, W_PEJABAT, W_BIROKRASI, LISTICLE,
  type WeightGroup,
} from '@/config/keywords';
import { SCORE_TINGGI, SCORE_SEDANG } from '@/config/thresholds';
import { norm, type FilteredArticle } from './filter';

export type Tier = 'tinggi' | 'sedang' | 'rendah';

export type ScoredArticle = FilteredArticle & {
  score: number;
  reasons: string[];   // bentuk internal, mis. "🏖wisata". UI yang menerjemahkan jadi badge.
};

export function tierOf(score: number): Tier {
  if (score >= SCORE_TINGGI) return 'tinggi';
  if (score >= SCORE_SEDANG) return 'sedang';
  return 'rendah';
}

const hit = (hay: string, g: WeightGroup) => g.words.filter((w) => hay.includes(w));

function scoreOne(it: FilteredArticle): ScoredArticle {
  const title = norm(it.title);
  const hay = norm(it.title + ' ' + it.desc);
  let s = 0;
  const reasons: string[] = [];

  // Tema dicek di judul + ringkasan.
  const w = hit(hay, W_WISATA);
  if (w.length) { s += W_WISATA.score * Math.min(w.length, 2); reasons.push(`🏖${w[0]}`); }

  const e = hit(hay, W_EKONOMI);
  if (e.length) { s += W_EKONOMI.score * Math.min(e.length, 2); reasons.push(`💰${e[0]}`); }

  const a = hit(hay, W_ACARA);
  if (a.length) { s += W_ACARA.score; reasons.push(`🎪${a[0]}`); }

  const p = hit(hay, W_PEJABAT);
  if (p.length) { s += W_PEJABAT.score; reasons.push(`🏛${p[0]}`); }

  const b = hit(hay, W_BIROKRASI);
  if (b.length) { s += W_BIROKRASI.score; reasons.push(`📋${b[0]}`); }

  // Penanda clickbait dicek di JUDUL saja — desc sering memuat kutipan wajar.
  const l = LISTICLE.filter((x) => title.includes(x));
  if (l.length) { s -= 4 * l.length; reasons.push(`📰${l[0]}`); }

  if (/^\d+\s/.test(it.title.trim())) { s -= 5; reasons.push('🔢'); }
  if (/[!?]/.test(it.title)) { s -= 3; reasons.push('❗'); }
  if (it.hits > 1) { s += 2; reasons.push(`✳️${it.hits}x`); }

  return { ...it, score: s, reasons };
}

/**
 * Skor + urut tertinggi dulu + tentukan wakil tiap gugus berita serupa.
 *
 * filterArticles() sudah mengelompokkan yang mirip dan menaruh ID akar gugus di
 * dupeOf. Di sini akar itu diganti WAKIL sebenarnya: anggota berskor tertinggi —
 * itu yang paling mungkin dipakai staf. Wakilnya sendiri dupeOf-nya null, supaya
 * kartunya bisa ditandai berbeda dari anggota lain.
 */
export function scoreArticles(items: FilteredArticle[]): ScoredArticle[] {
  const sorted = items.map(scoreOne).sort((x, y) => y.score - x.score);

  const gugus = new Map<string, ScoredArticle[]>();
  for (const a of sorted) {
    if (!a.dupeOf) continue;
    (gugus.get(a.dupeOf) ?? gugus.set(a.dupeOf, []).get(a.dupeOf)!).push(a);
  }
  for (const isi of gugus.values()) {
    // sorted sudah urut skor menurun, jadi anggota pertama = skor tertinggi.
    const wakil = isi[0];
    for (const a of isi) a.dupeOf = a === wakil ? null : wakil.id;
    for (const a of isi) a.grupUkuran = isi.length;
  }

  return sorted;
}
