import { summarizeMany, type ArtikelUntukRingkas } from '@/lib/gemini';

export const maxDuration = 300;

const MAKS = 5;

const sah = (a: unknown): a is ArtikelUntukRingkas =>
  !!a && typeof a === 'object'
  && typeof (a as ArtikelUntukRingkas).title === 'string'
  && typeof (a as ArtikelUntukRingkas).sourceName === 'string'
  && typeof (a as ArtikelUntukRingkas).fullText === 'string'
  && (a as ArtikelUntukRingkas).fullText.trim().length > 0;

export async function POST(req: Request) {
  const { articles } = await req.json().catch(() => ({}));

  if (!Array.isArray(articles) || articles.length === 0 || articles.length > MAKS) {
    return Response.json({ error: `Kirim 1-${MAKS} artikel.` }, { status: 400 });
  }
  if (!articles.every(sah)) {
    return Response.json({ error: 'Isi artikel kosong atau tidak lengkap.' }, { status: 400 });
  }

  return Response.json({ summaries: await summarizeMany(articles) });
}
