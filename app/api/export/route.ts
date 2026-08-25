import puppeteer from 'puppeteer';
import { renderNewsletter, type ArtikelNewsletter } from '@/templates/newsletter';
import { UA } from '@/config/keywords';

export const maxDuration = 120;

const MAKS = 10;
const ymd = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Gambar WAJIB masuk PDF sebagai base64 — kalau tetap URL eksternal, PDF-nya
 * kosong saat dibuka offline atau kalau portalnya menghapus gambarnya.
 */
async function keBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;   // hasil upload user, sudah base64
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://www.google.com/' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const tipe = res.headers.get('content-type') ?? 'image/jpeg';
    if (!tipe.startsWith('image/')) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return `data:${tipe};base64,${b64}`;
  } catch {
    return null;   // gambar gagal bukan alasan menggagalkan seluruh PDF
  }
}

export async function POST(req: Request) {
  const { publishDate, articles } = await req.json().catch(() => ({}));

  if (!ymd.test(publishDate ?? '')) {
    return Response.json({ error: 'Tanggal terbit tidak valid.' }, { status: 400 });
  }
  if (!Array.isArray(articles) || articles.length === 0 || articles.length > MAKS) {
    return Response.json({ error: `Kirim 1-${MAKS} artikel.` }, { status: 400 });
  }
  if (!articles.every((a) => a && typeof a.title === 'string' && typeof a.summary === 'string' && /^https?:\/\//.test(a.url ?? ''))) {
    return Response.json({ error: 'Ada artikel tanpa judul, ringkasan, atau link sumber.' }, { status: 400 });
  }

  const siap: ArtikelNewsletter[] = await Promise.all(
    articles.map(async (a: ArtikelNewsletter) => ({ ...a, imageUrl: await keBase64(a.imageUrl) })),
  );

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(renderNewsletter(publishDate, siap), { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    // TANPA Content-Disposition: attachment. Download manager (IDM, dsb) mencegat
    // respons ber-attachment dan mengembalikan 204 kosong ke halaman — PDF-nya hilang.
    // Nama berkas tetap benar karena halaman preview memakai atribut `download`.
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'X-Filename': `Sanghyang_Highlights_${publishDate}.pdf`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return Response.json({ error: `Gagal membuat PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
