import { searchAll } from '@/lib/googlenews';
import { filterArticles } from '@/lib/filter';
import { scoreArticles } from '@/lib/scoring';
import { toUi, grupOf } from '@/lib/ui';

export const maxDuration = 60;

const MAKS_HARI = 90;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Balasannya NDJSON yang dialirkan, bukan JSON sekali jadi — supaya halaman 1
 * bisa menampilkan "Mencari berita… (7/19)" alih-alih spinner diam 10-30 detik.
 */
export async function POST(req: Request) {
  const { dateFrom, dateTo } = await req.json().catch(() => ({}));

  if (!ymd.test(dateFrom ?? '') || !ymd.test(dateTo ?? '')) {
    return Response.json({ error: 'Tanggal tidak valid.' }, { status: 400 });
  }
  if (dateFrom > dateTo) {
    return Response.json({ error: 'Tanggal awal melewati tanggal akhir.' }, { status: 400 });
  }
  const hari = (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000 + 1;
  if (hari > MAKS_HARI) {
    return Response.json({ error: `Rentang maksimal ${MAKS_HARI} hari.` }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const kirim = (o: unknown) => c.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const { articles: raw, failedQueries } = await searchAll(dateFrom, dateTo, (sudah, total) =>
          kirim({ tahap: 'cari', sudah, total }),
        );
        kirim({ tahap: 'saring' });

        const { articles } = filterArticles(raw);
        const sc = scoreArticles(articles);
        kirim({
          tahap: 'selesai',
          articles: sc.map(toUi),
          utama: sc.filter((a) => grupOf(a.score) === 'utama').length,
          failedQueries,
        });
      } catch (e) {
        kirim({ tahap: 'galat', pesan: (e as Error).message });
      }
      c.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
