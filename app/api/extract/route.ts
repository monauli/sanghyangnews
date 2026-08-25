import { extractMany } from '@/lib/extractor';

export const maxDuration = 60;

const MAKS = 10;

/** Server ini akan mengambil URL yang dikirim browser — batasi ke http(s) publik saja. */
function urlAman(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return !/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|\[|0\.0\.0\.0$)/.test(hostname)
      && !/^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { urls } = await req.json().catch(() => ({}));

  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAKS) {
    return Response.json({ error: `Kirim 1-${MAKS} alamat.` }, { status: 400 });
  }
  if (!urls.every(urlAman)) {
    return Response.json({ error: 'Alamat tidak valid.' }, { status: 400 });
  }

  return Response.json({ results: await extractMany(urls) });
}
