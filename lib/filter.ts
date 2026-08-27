/**
 * Filter lokal (BACKEND.md §6). Gratis, instan, tidak makan kuota API.
 * Urutan: dedupe antar query → portal iklan → blacklist → lokasi wajib di judul → tandai mirip.
 */
import { BLACKLIST, REGIONAL_BLACKLIST, SUMBER_BLACKLIST, LOC_KEYS, PENGUAT_SERANG } from '@/config/keywords';
import { DUPE_THRESHOLD } from '@/config/thresholds';
import { judulBersih } from './judul';
import type { RawArticle } from './googlenews';

export type FilteredArticle = RawArticle & {
  id: string;          // dari segmen link Google
  /**
   * Judul tanpa ekor nama media, huruf besar-kecil dipertahankan.
   * SATU-SATUNYA judul yang boleh dibaca tahap mana pun setelah ini —
   * `title` mentah masih memuat " - NamaSumber" dan itu pernah membuat
   * berita luar negeri lolos hanya karena medianya bernama "Radar Banten".
   */
  judul: string;
  location: string;    // lokasi yang cocok di judul, mis. "cilegon"
  hits: number;        // ditemukan di berapa query
  /**
   * ID WAKIL gugus berita serupa — ID, BUKAN index (urutan array berubah saat sorting).
   * null berarti artikel ini sendiri wakilnya, atau tidak punya kembaran.
   */
  dupeOf: string | null;
  /** Banyaknya artikel dalam gugus ini, termasuk dirinya. 1 = tidak punya kembaran. */
  grupUkuran: number;
};

export type FilterStats = {
  raw: number;
  unique: number;
  droppedSumber: number;
  droppedBlacklist: number;
  droppedRegional: number;
  droppedLocation: number;
  kept: number;
  duped: number;
};

/**
 * Bentuk banding: judul bersih, huruf dikecilkan, tag HTML dibuang.
 *
 * Dulu di sini ada bareTitle(), yang mengupas ekor SEKALI dengan
 * / - [^-]+$/ dan cuma dipakai untuk cek regional + lokasi. Dua lubangnya:
 *   1. ekor ganda ("… - tangerangekspres.disway.id - Radar Banten") cuma
 *      terkupas satu, jadi nama domain ikut dibandingkan;
 *   2. `hay` (blacklist + penguat "serang") dan seluruh lib/scoring.ts
 *      membaca judul MENTAH, nama media dan semua.
 * Akibatnya artikel yang sama lolos atau dibuang tergantung siapa yang
 * memberitakan: "Israel Kembali Serang Gaza - Radar Banten" lolos karena
 * kata "banten" di nama medianya, versi CNN-nya dibuang.
 *
 * Sekarang judulnya dibersihkan SEKALI di sini dengan judulBersih() yang
 * sudah teruji, disimpan di field `judul`, dan setiap pembanding memakai
 * norm(a.judul). Yang butuh bentuk tampilan pakai `judul` apa adanya.
 */

export const norm = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** ID artikel = segmen terakhir URL Google News. */
export function idOf(link: string): string {
  return (link.split('/').pop() || '').split('?')[0].slice(0, 60);
}

/**
 * Portal iklan? Cocokkan per label domain, jangan substring mentah —
 * "olx" sebagai substring juga kena "polxpress.com".
 */
function sumberIklan(sourceUrl: string, sourceName: string): boolean {
  let host: string;
  try { host = new URL(sourceUrl).hostname.toLowerCase(); }
  catch { host = sourceName.toLowerCase().replace(/\s+/g, ''); }   // RSS lama tanpa atribut url
  return SUMBER_BLACKLIST.some((d) =>
    host === d || host.startsWith(d + '.') || host.endsWith('.' + d) || host.includes('.' + d + '.'));
}

/**
 * Lokasi yang meloloskan artikel, atau null kalau tidak ada.
 * Kata lokasi dicari di JUDUL; khusus "serang" penguatnya boleh di ringkasan juga,
 * karena berita Serang yang sah hampir selalu menyebut Banten di paragraf awal.
 */
/** Isi PENGUAT_SERANG adalah sumber regex, bukan teks polos — jangan di-escape. */
const RX_PENGUAT = new RegExp(`\\b(?:${PENGUAT_SERANG.join('|')})\\b`);

function lokasiDari(title: string, hay: string): string | null {
  const cocok = LOC_KEYS.filter((l) => title.includes(l));
  if (!cocok.length) return null;
  const takAmbigu = cocok.find((l) => l !== 'serang');
  if (takAmbigu) return takAmbigu;
  return RX_PENGUAT.test(hay) ? 'serang' : null;
}

function titleWords(judul: string): Set<string> {
  return new Set(norm(judul).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
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
    else seen.set(id, { ...it, id, judul: judulBersih(it.title, it.sourceName), location: '', hits: 1, dupeOf: null, grupUkuran: 1 });
  }
  const unique = [...seen.values()];

  // 2-5. Portal iklan (domain) → blacklist (judul+desc) → regional (judul) → lokasi wajib di JUDUL.
  // Portal iklan dicek DULUAN: iklan properti sering memuat lokasi & kata "resort"
  // di judulnya, jadi kalau ditaruh belakangan ia lolos semua saringan lain.
  let droppedSumber = 0;
  let droppedBlacklist = 0;
  let droppedRegional = 0;
  let droppedLocation = 0;
  const kept: FilteredArticle[] = [];
  for (const it of unique) {
    const title = norm(it.judul);
    const hay = norm(it.judul + ' ' + it.desc);
    if (sumberIklan(it.sourceUrl, it.sourceName)) { droppedSumber++; continue; }
    if (BLACKLIST.some((b) => hay.includes(b))) { droppedBlacklist++; continue; }
    if (REGIONAL_BLACKLIST.some((r) => title.includes(r))) { droppedRegional++; continue; }
    const loc = lokasiDari(title, hay);
    if (!loc) { droppedLocation++; continue; }
    kept.push({ ...it, location: loc });
  }

  // 4. Kelompokkan yang mirip — TIDAK dibuang, user yang putuskan.
  //
  // Dulu ini rantai: tiap artikel dicocokkan sampai ketemu SATU pasangan lalu
  // `break`. Pada peristiwa besar (12 berita Krakatau dari 12 media) hasilnya
  // rantai panjang, bukan satu gugus — stafnya melihat beberapa tanda terpencar
  // dan tidak pernah tahu ada dua belas berita yang sama.
  //
  // Sekarang union-find: semua yang saling mirip masuk satu gugus, walau A dan C
  // tidak langsung mirip asal sama-sama mirip B.
  // ponytail: O(n²) atas ~300 judul (~45rb banding, <50ms). Kalau nanti ribuan, pakai shingle index.
  const words = kept.map((a) => titleWords(a.judul));
  const induk = kept.map((_, i) => i);
  const cari = (i: number): number => (induk[i] === i ? i : (induk[i] = cari(induk[i])));
  for (let i = 0; i < kept.length; i++) {
    for (let j = 0; j < i; j++) {
      if (jaccard(words[i], words[j]) >= DUPE_THRESHOLD) induk[cari(i)] = cari(j);
    }
  }

  const anggota = new Map<number, number[]>();
  for (let i = 0; i < kept.length; i++) {
    const akar = cari(i);
    (anggota.get(akar) ?? anggota.set(akar, []).get(akar)!).push(i);
  }
  // dupeOf diisi ID akar gugus sebagai penanda keanggotaan sementara.
  // scoreArticles() yang menentukan wakil sebenarnya — pemilihannya butuh skor,
  // dan skor belum ada di tahap ini.
  let duped = 0;
  for (const [akar, isi] of anggota) {
    if (isi.length < 2) continue;
    for (const i of isi) {
      kept[i].grupUkuran = isi.length;
      kept[i].dupeOf = kept[akar].id;
    }
    duped += isi.length - 1;
  }

  return {
    articles: kept,
    stats: { raw: raw.length, unique: unique.length, droppedSumber, droppedBlacklist, droppedRegional, droppedLocation, kept: kept.length, duped },
  };
}
