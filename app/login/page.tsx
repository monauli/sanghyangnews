'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HalamanMasuk() {
  const router = useRouter();
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [kirim, setKirim] = useState(false);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    if (!sandi) return;
    setKirim(true);
    setGalat(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sandi }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Gagal masuk.');
      router.replace('/');
      router.refresh();
    } catch (e) {
      setGalat((e as Error).message);
      setKirim(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-green-900">Sanghyang Highlights</h1>
        <p className="mt-1 text-sm text-gray-500">Masukkan sandi untuk melanjutkan.</p>

        <form onSubmit={masuk} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Sandi
            <input
              type="password"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={kirim}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal text-gray-900 focus:border-green-800 focus:outline-none disabled:bg-gray-50"
            />
          </label>

          {galat && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800">{galat}</p>
          )}

          <button
            type="submit"
            disabled={!sandi || kirim}
            className="rounded-lg bg-green-800 px-6 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {kirim ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    </main>
  );
}
