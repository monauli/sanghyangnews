import { NAMA_COOKIE, UMUR_COOKIE, sandiCocok, tokenDari } from '@/lib/sandi';

export const maxDuration = 60;

export async function POST(req: Request) {
  const sandi = process.env.APP_PASSWORD;
  if (!sandi) {
    return Response.json({ error: 'APP_PASSWORD belum diatur di server.' }, { status: 503 });
  }

  const { password } = await req.json().catch(() => ({}));

  if (!sandiCocok(password, sandi)) {
    return Response.json({ error: 'Sandi salah.' }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.set(
    'Set-Cookie',
    [
      `${NAMA_COOKIE}=${tokenDari(sandi)}`,
      'Path=/',
      `Max-Age=${UMUR_COOKIE}`,
      'HttpOnly',
      'SameSite=Lax',
      // Vercel selalu https; di lokal http, jadi Secure hanya dipasang di sana.
      process.env.VERCEL ? 'Secure' : '',
    ].filter(Boolean).join('; '),
  );
  return res;
}
