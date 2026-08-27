/**
 * Google News RSS — 19 query (BACKEND.md §4).
 * Pola parseRss() & fetchQuery() disalin dari spike5.mjs (terbukti: 669 artikel, 0 mentok).
 */
import { QUERIES, UA } from '@/config/keywords';

export type RawArticle = {
  /**
   * MENTAH — masih berakhiran " - NamaSumber", kadang dua kali.
   * Jangan dibandingkan, jangan diskor, jangan ditampilkan. Satu-satunya
   * yang boleh membacanya adalah filterArticles(), yang membersihkannya
   * jadi FilteredArticle.judul. Tahap sesudahnya pakai judul itu.
   */
  title: string;
  link: string;       // URL Google News (terenkripsi) — perlu resolver
  pubDate: string;    // YYYY-MM-DD saja. Jam sengaja dibuang, lihat catatan di bawah.
  desc: string;
  sourceName: string;
  sourceUrl: string;  // dari atribut url pada <source> — dipakai menyaring portal iklan
  query: string;      // query yang menemukannya
};

export type QueryStat = { query: string; count: number; capped: boolean; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function timeout(ms: number) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/**
 * pubDate dari Google selalu dinormalisasi ke 07:00:00 GMT — jamnya PALSU.
 * Ambil tanggalnya saja supaya tidak ada yang tergoda memakai jamnya.
 */
function dateOnly(pubDate: string): string {
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** `before:` di Google News eksklusif — user pilih s/d 30 Juni, kirim 1 Juli. */
export function nextDay(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseRss(xml: string): Omit<RawArticle, 'query'>[] {
  return xml.split('<item>').slice(1).map((b) => {
    const pick = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      if (!m) return '';
      return m[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .trim();
    };
    return {
      title: pick('title'),
      link: pick('link'),
      pubDate: dateOnly(pick('pubDate')),
      desc: pick('description'),
      sourceName: pick('source'),
      sourceUrl: (b.match(/<source[^>]*url="([^"]*)"/) ?? [])[1] ?? '',
    };
  });
}

export async function fetchQuery(q: string, after: string, before: string): Promise<RawArticle[]> {
  const enc = encodeURIComponent(`${q} after:${after} before:${before}`);
  const url = `https://news.google.com/rss/search?q=${enc}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseRss(await res.text()).map((it) => ({ ...it, query: q }));
}

/**
 * @param dateFrom YYYY-MM-DD (inklusif)
 * @param dateTo   YYYY-MM-DD (inklusif — konversi ke `before:` eksklusif di sini)
 * @param onProgress dipanggil tiap query selesai — dipakai indikator progres di UI
 */
export async function searchAll(
  dateFrom: string,
  dateTo: string,
  onProgress?: (sudah: number, total: number) => void,
) {
  const before = nextDay(dateTo);
  const stats: QueryStat[] = [];
  let articles: RawArticle[] = [];

  // Sekuensial + jeda 200ms: Google tidak suka 19 request sekaligus.
  for (const q of QUERIES) {
    try {
      const items = await fetchQuery(q, dateFrom, before);
      articles = articles.concat(items);
      stats.push({ query: q, count: items.length, capped: items.length >= 100 });
    } catch (e) {
      // Satu query gagal tidak menggagalkan sisanya.
      stats.push({ query: q, count: 0, capped: false, error: (e as Error).message });
    }
    onProgress?.(stats.length, QUERIES.length);
    await sleep(200);
  }

  return { articles, stats, failedQueries: stats.filter((s) => s.error).length };
}
