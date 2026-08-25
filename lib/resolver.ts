/**
 * Resolver URL Google News (BACKEND.md §5) — KRITIS.
 * resolveOne() DISALIN dari spike3.mjs baris 187. Jangan tulis ulang:
 * follow-redirect & decode base64 sudah diuji dan GAGAL 0/5.
 *
 * batchexecute adalah API INTERNAL Google, bukan API resmi. Bisa berubah
 * sewaktu-waktu — itu sebabnya resolveMany() tidak pernah melempar exception.
 */
import { UA } from '@/config/keywords';

// URL pertama di response yang bukan milik google
const RX_URL = /https?:\/\/(?!.*google\.com)[^\s"'\\]+/;

export type ResolveResult = { link: string; finalUrl: string | null; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function timeout(ms: number) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// Cache per session. Resolve itu mahal (~0,5 detik) dan hasilnya tidak berubah.
const cache = new Map<string, string>();

/** Melempar exception kalau gagal. Pakai resolveMany() untuk versi yang aman. */
export async function resolveOne(gnUrl: string): Promise<string> {
  const hit = cache.get(gnUrl);
  if (hit) return hit;

  const page = await fetch(gnUrl, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' },
    signal: timeout(12000),
  });
  const html = await page.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/);
  const ts = html.match(/data-n-a-ts="([^"]+)"/);
  if (!sg || !ts) throw new Error('signature tidak ada');

  const id = gnUrl.split('/').pop()!.split('?')[0];
  const payload = JSON.stringify([[[
    'Fbv4je',
    JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
        'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id, Number(ts[1]), sg[1],
    ]),
    null, 'generic',
  ]]]);

  const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'f.req=' + encodeURIComponent(payload),
    signal: timeout(12000),
  });
  const m = (await res.text()).match(RX_URL);
  if (!m) throw new Error('link tidak ditemukan');

  cache.set(gnUrl, m[0]);
  return m[0];
}

/** Sekuensial + jeda 300ms. Tidak pernah melempar — artikel gagal tetap tampil di UI. */
export async function resolveMany(links: string[]): Promise<ResolveResult[]> {
  const out: ResolveResult[] = [];
  for (const [i, link] of links.entries()) {
    const dariCache = cache.has(link);
    try {
      out.push({ link, finalUrl: await resolveOne(link) });
    } catch (e) {
      out.push({ link, finalUrl: null, error: (e as Error).message });
    }
    // Jeda hanya perlu kalau tadi benar-benar memanggil Google.
    if (!dariCache && i < links.length - 1) await sleep(300);
  }
  return out;
}
