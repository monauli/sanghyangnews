/**
 * Penjaga akses seluruh aplikasi.
 *
 * Di Next 16 berkas ini bernama `proxy.ts` — `middleware.ts` sudah deprecated.
 * Jalan di runtime Node, jadi node:crypto tersedia.
 *
 * Melindungi HALAMAN dan /api/* sekaligus: route API bisa ditembak langsung
 * tanpa lewat halaman, jadi menjaga halaman saja tidak ada gunanya.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { NAMA_COOKIE, tokenSah } from '@/lib/sandi';

const TERBUKA = ['/login', '/api/login'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const untukApi = pathname.startsWith('/api/');

  const sandi = process.env.APP_PASSWORD;

  // FAIL-CLOSED: tanpa APP_PASSWORD, aplikasinya dikunci — bukan dibuka bebas.
  // Salah setel di dashboard tidak boleh berarti pintu terbuka untuk umum.
  if (!sandi) {
    const pesan = 'APP_PASSWORD belum diatur di server. Aplikasi dikunci sampai diisi.';
    return untukApi
      ? NextResponse.json({ error: pesan }, { status: 503 })
      : new NextResponse(halamanTerkunci(pesan), {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
  }

  if (TERBUKA.includes(pathname)) return NextResponse.next();

  if (tokenSah(req.cookies.get(NAMA_COOKIE)?.value, sandi)) return NextResponse.next();

  if (untukApi) {
    return NextResponse.json({ error: 'Belum masuk. Muat ulang halaman lalu masukkan sandi.' }, { status: 401 });
  }

  const tujuan = req.nextUrl.clone();
  tujuan.pathname = '/login';
  tujuan.search = '';
  return NextResponse.redirect(tujuan);
}

/** Halaman darurat tanpa React — proxy tidak bisa merender komponen. */
const halamanTerkunci = (pesan: string) => `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Terkunci</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f9fafb;padding:3rem;color:#111">
<h1 style="color:#14532d;font-size:1.25rem">Aplikasi terkunci</h1>
<p>${pesan}</p>
</body></html>`;

export const config = {
  // Semua kecuali berkas statis Next dan favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
