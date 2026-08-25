import { extractMany } from '@/lib/extractor';
import { urlAman } from '@/lib/urlaman';

export const maxDuration = 60;

const MAKS = 10;

export async function POST(req: Request) {
  const { urls } = await req.json().catch(() => ({}));

  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAKS) {
    return Response.json({ error: `Kirim 1-${MAKS} alamat.` }, { status: 400 });
  }
  // Server ini akan mengambil URL yang dikirim browser — batasi ke http(s) publik saja.
  if (!urls.every(urlAman)) {
    return Response.json({ error: 'Alamat tidak valid.' }, { status: 400 });
  }

  return Response.json({ results: await extractMany(urls) });
}
