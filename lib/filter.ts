/**
 * Filter lokal (BACKEND.md §6). Gratis, instan, tidak makan kuota API.
 * Urutan: dedupe antar query → blacklist → lokasi wajib di judul → tandai mirip.
 */
import { BLACKLIST, REGIONAL_BLACKLIST, LOC_KEYS } from '@/config/keywords';
import { DUPE_THRESHOLD } from '@/config/thresholds';
import type { RawArticle } from './googlenews';

export type FilteredArticle = RawArticle & {
  id: string;          // dari segmen link Google
  location: string;    // lokasi yang cocok di judul, mis. "cilegon"
  hits: number;        // ditemukan di berapa query
  dupeOf: string | null; // ID artikel mirip — ID, BUKAN index (urutan array berubah saat sorting)
};

export type FilterStats = {
  raw: number;
  unique: number;
  droppedBlacklist: number;
  droppedRegional: number;
  droppedLocation: number;
  kept: number;
  duped: number;
};

export const norm = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** ID artikel = segmen terakhir URL Google News. */
export function idOf(link: string): string {
  return (link.split('/').pop() || '').split('?')[0].slice(0, 60);
}

/**
 * Judul RSS Google selalu berakhiran " - NamaSumber". Wajib dibuang sebelum dipakai:
 * banyak portal bernama "radarbanten.co.id" / "Kabar Banten" — kalau ikut, cek lokasi
 * mencocokkan nama portalnya, bukan isi beritanya.
 */
export const bareTitle = (t: string) => norm(t).replace(/ - [^-]+$/, '');

function titleWords(title: string): Set<string> {
  return new Set(bareTitle(title).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export function filterArticles(raw: RawArticle[]): { articles: FilteredArticle[]; stats: FilterStats } {
  // 1. Dedupe antar query — ~34% artikel muncul di lebih dari satu query.
  const seen = new Map<string, FilteredArticle>();
  for (const it of raw) {
    const id = idOf(it.link);
    const hit = seen.get(id);
    if (hit) hit.hits++;
    else seen.set(id, { ...it, id, location: '', hits: 1, dupeOf: null });
  }
  const unique = [...seen.values()];

  // 2, 3 & 4. Blacklist (judul+desc) → regional (judul) → lokasi wajib di JUDUL.
  let droppedBlacklist = 0;
  let droppedRegional = 0;
  let droppedLocation = 0;
  const kept: FilteredArticle[] = [];
  for (const it of unique) {
    const title = bareTitle(it.title);
    const hay = norm(it.title + ' ' + it.desc);
    if (BLACKLIST.some((b) => hay.includes(b))) { droppedBlacklist++; continue; }
    if (REGIONAL_BLACKLIST.some((r) => title.includes(r))) { droppedRegional++; continue; }
    const loc = LOC_KEYS.find((l) => title.includes(l));
    if (!loc) { droppedLocation++; continue; }
    kept.push({ ...it, location: loc });
  }

  // 4. Tandai yang mirip — TIDAK dibuang, user yang putuskan.
  // ponytail: O(n²) atas ~300 judul (~45rb banding, <50ms). Kalau nanti ribuan, pakai shingle index.
  const words = kept.map((a) => titleWords(a.title));
  let duped = 0;
  for (let i = 0; i < kept.length; i++) {
    for (let j = 0; j < i; j++) {
      if (jaccard(words[i], words[j]) >= DUPE_THRESHOLD) {
        kept[i].dupeOf = kept[j].id; // yang duluan muncul jadi acuan
        duped++;
        break;
      }
    }
  }

  return {
    articles: kept,
    stats: { raw: raw.length, unique: unique.length, droppedBlacklist, droppedRegional, droppedLocation, kept: kept.length, duped },
  };
}
