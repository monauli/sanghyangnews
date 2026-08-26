'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '../components/StepIndicator';
import { KUNCI, type ArtikelTerpilih } from '@/lib/ui';
import { renderNewsletter, type Periode } from '@/templates/newsletter';

/** "2026-07-01..2026-07-31" → { dari, sampai }. Null kalau belum pernah dicari. */
function bacaPeriode(): Periode {
  const [dari, sampai] = (sessionStorage.getItem(KUNCI.periode) ?? '').split('..');
  return dari && sampai ? { dari, sampai } : null;
}

const hariIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function HalamanPreview() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<ArtikelTerpilih[] | null>(null);
  const [tanggal, setTanggal] = useState('');
  const [periode, setPeriode] = useState<Periode>(null);
  const [unduh, setUnduh] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    const mentah = sessionStorage.getItem(KUNCI.pilihan);
    if (!mentah) { router.replace('/'); return; }
    setArtikel(JSON.parse(mentah));
    setTanggal(sessionStorage.getItem(KUNCI.tanggal) || hariIni());
    setPeriode(bacaPeriode());
  }, [router]);

  useEffect(() => {
    if (tanggal) sessionStorage.setItem(KUNCI.tanggal, tanggal);
  }, [tanggal]);

  // Preview memakai template yang sama persis dengan Puppeteer — tanpa kejutan.
  const html = useMemo(
    () => (artikel && tanggal ? renderNewsletter(tanggal, artikel, periode) : ''),
    [artikel, tanggal, periode],
  );

  function geser(i: number, arah: -1 | 1) {
    setArtikel((a) => {
      if (!a) return a;
      const j = i + arah;
      if (j < 0 || j >= a.length) return a;
      const baru = [...a];
      [baru[i], baru[j]] = [baru[j], baru[i]];
      sessionStorage.setItem(KUNCI.pilihan, JSON.stringify(baru));
      return baru;
    });
  }

  async function unduhPdf() {
    if (!artikel) return;
    setUnduh(true);
    setGalat(null);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishDate: tanggal, articles: artikel, periode }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Gagal (${res.status})`);

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Sanghyang_Highlights_${tanggal}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setUnduh(false);
    }
  }

  if (!artikel) return <main className="p-12 text-center text-gray-500">Memuat…</main>;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pb-16 pt-10">
      <StepIndicator aktif={3} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <button onClick={() => router.push('/review')} className="text-sm text-gray-500 hover:text-green-900">
          ← Kembali ke Review
        </button>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Tanggal terbit
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 font-normal text-gray-900 focus:border-green-800 focus:outline-none"
          />
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Urutan artikel</p>
        <ol className="flex flex-col gap-2">
          {artikel.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <span className="w-5 text-sm text-gray-400">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{a.title}</span>
              <button
                onClick={() => geser(i, -1)}
                disabled={i === 0}
                aria-label="Naikkan"
                className="rounded border border-gray-300 px-2 py-0.5 text-sm hover:border-green-800 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => geser(i, 1)}
                disabled={i === artikel.length - 1}
                aria-label="Turunkan"
                className="rounded border border-gray-300 px-2 py-0.5 text-sm hover:border-green-800 disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      </div>

      <iframe
        title="Pratinjau newsletter"
        srcDoc={html}
        className="h-[860px] w-full rounded-xl border border-gray-300 bg-white shadow-sm"
      />

      {galat && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ {galat}
        </p>
      )}

      <div className="flex justify-center">
        <button
          onClick={unduhPdf}
          disabled={unduh}
          className="rounded-lg bg-green-800 px-8 py-3 font-semibold text-white shadow-lg hover:bg-green-900 disabled:cursor-wait disabled:bg-gray-400"
        >
          {unduh ? 'Menyiapkan PDF…' : galat ? 'Coba Lagi' : 'Download PDF'}
        </button>
      </div>
    </main>
  );
}
