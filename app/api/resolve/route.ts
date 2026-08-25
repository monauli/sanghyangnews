import { resolveMany } from '@/lib/resolver';

export const maxDuration = 60;

const MAKS = 10;

export async function POST(req: Request) {
  const { links } = await req.json().catch(() => ({}));

  if (!Array.isArray(links) || links.length === 0 || links.length > MAKS) {
    return Response.json({ error: `Kirim 1-${MAKS} link.` }, { status: 400 });
  }
  // Hanya link Google News yang boleh masuk — ini yang memang perlu di-resolve.
  if (!links.every((l) => typeof l === 'string' && l.startsWith('https://news.google.com/'))) {
    return Response.json({ error: 'Link tidak dikenali.' }, { status: 400 });
  }

  return Response.json({ results: await resolveMany(links) });
}
