/**
 * Ambil isi artikel + gambar (BACKEND.md §8).
 * FULL_HEADERS disalin dari spike3.mjs baris 50 — request polos ditolak sebagian portal.
 * Tidak pernah melempar exception: portal bermasalah tetap tampil di UI dengan opsi input manual.
 */
import { extractFromHtml } from '@extractus/article-extractor';
import { UA } from '@/config/keywords';
import { fetchAman, urlAman } from './urlaman';

export type ExtractResult = {
  url: string;
  title: string | null;
  fullText: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  attempt: 'header-lengkap' | 'tanpa-referer' | 'gagal';
  warnings: string[];   // 'teks-pendek' | 'teks-kosong' | 'gambar-tidak-ada' | 'gambar-kecil'
  error?: string;
};

const MIN_TEXT = 1500;
const MIN_IMAGE_WIDTH = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function timeout(ms: number) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

const FULL_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.google.com/',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
};

/** Retry 2 tahap — sebagian portal menolak referer eksternal. */
async function fetchHtml(url: string) {
  let res = await fetchAman(url, { headers: FULL_HEADERS, signal: timeout(12000) });
  if (res.ok) return { res, attempt: 'header-lengkap' as const };

  const h2 = { ...FULL_HEADERS };
  delete h2.Referer;
  delete h2['Sec-Fetch-Site'];
  res = await fetchAman(url, { headers: h2, signal: timeout(12000) });
  return { res, attempt: res.ok ? ('tanpa-referer' as const) : ('gagal' as const) };
}

/**
 * Isi atribut HTML masih berupa entitas. og:image yang punya query string
 * biasanya ditulis `...?src=x&amp;price=y` — kalau `&amp;` tidak dikembalikan
 * jadi `&`, alamatnya salah dan gambarnya gagal dimuat di browser.
 */
const ENTITAS: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'",
};

export const bukaEntitas = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/gi, (utuh, e: string) => ENTITAS[e.toLowerCase()] ?? utuh);

const meta = (html: string, prop: string) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)`, 'i'));
  return m ? bukaEntitas(m[1]) : null;
};

/**
 * Lebar gambar: pakai meta og:image:width kalau ada, kalau tidak baca header berkasnya.
 * ponytail: cuma PNG/JPEG/WebP. Format lain → null (dianggap tidak diketahui, bukan kecil).
 */
async function imageWidth(html: string, imgUrl: string): Promise<number | null> {
  const fromMeta = Number(meta(html, 'og:image:width'));
  if (fromMeta > 0) return fromMeta;
  if (!urlAman(imgUrl)) return null;

  try {
    const res = await fetchAman(imgUrl, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-65535' },
      signal: timeout(8000),
    });
    if (!res.ok) return null;
    const b = Buffer.from(await res.arrayBuffer());

    if (b.length > 24 && b.toString('ascii', 1, 4) === 'PNG') return b.readUInt32BE(16);

    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {          // JPEG: cari marker SOFn
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        const sof = (m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7)
          || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf);
        if (sof) return b.readUInt16BE(i + 7);
        i += 2 + b.readUInt16BE(i + 2);
      }
      return null;
    }

    if (b.length > 30 && b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16);
      if (kind === 'VP8X') return (b.readUIntLE(24, 3) & 0xffffff) + 1;
      if (kind === 'VP8 ') return b.readUInt16LE(26) & 0x3fff;
      if (kind === 'VP8L') return ((b.readUInt16LE(21) & 0x3fff) + 1);
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractOne(url: string): Promise<ExtractResult> {
  const base: ExtractResult = {
    url, title: null, fullText: null, imageUrl: null, imageWidth: null,
    attempt: 'gagal', warnings: [],
  };

  if (!urlAman(url)) return { ...base, error: 'alamat tidak valid' };

  let html: string;
  let attempt: ExtractResult['attempt'];
  try {
    const r = await fetchHtml(url);
    attempt = r.attempt;
    if (!r.res.ok) return { ...base, attempt, error: `HTTP ${r.res.status}` };
    html = await r.res.text();
  } catch (e) {
    return { ...base, error: (e as Error).message };
  }

  const warnings: string[] = [];
  let fullText: string | null = null;
  let title = meta(html, 'og:title') ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? null;

  try {
    const art = await extractFromHtml(html, url);
    if (art?.content) fullText = art.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (art?.title) title = art.title;
  } catch (e) {
    warnings.push('ekstraksi-gagal:' + (e as Error).message);
  }

  if (!fullText) warnings.push('teks-kosong');
  else if (fullText.length < MIN_TEXT) warnings.push('teks-pendek');   // kemungkinan butuh JS render

  const imageUrl = meta(html, 'og:image') ?? meta(html, 'twitter:image');
  let width: number | null = null;
  if (!imageUrl) warnings.push('gambar-tidak-ada');
  else {
    width = await imageWidth(html, new URL(imageUrl, url).href);
    if (width !== null && width < MIN_IMAGE_WIDTH) warnings.push('gambar-kecil');
  }

  return { url, title, fullText, imageUrl, imageWidth: width, attempt, warnings };
}

/** Sekuensial + jeda 300ms. Tidak pernah melempar. */
export async function extractMany(urls: string[]): Promise<ExtractResult[]> {
  const out: ExtractResult[] = [];
  for (const [i, url] of urls.entries()) {
    out.push(await extractOne(url));
    if (i < urls.length - 1) await sleep(300);
  }
  return out;
}
