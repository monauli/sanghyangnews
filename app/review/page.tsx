'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '../components/StepIndicator';
import ArticleCard, { kerjaBaru, sedangProses, type Kerja } from './ArticleCard';
import { KUNCI, JUDUL_GRUP, grupOf, type Grup, type UiArticle, type ArtikelTerpilih } from '@/lib/ui';
import { cekJiplakan } from '@/lib/jiplak';
import { batasi } from '@/lib/antre';

const URUTAN_GRUP: Grup[] = ['utama', 'lain', 'kurang'];

async function kirim<T>(jalur: string, body: unknown): Promise<T> {
  const res = await fetch(jalur, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Gagal (${res.status})`);
  return data as T;
}

/**
 * 2 slot + jeda 4,2 detik antar-mulai = maksimal ~14 permintaan/menit.
 *
 * Batas jumlah bersamaan saja tidak cukup: gemini-3.5-flash-lite membalas dalam
 * 1-2 detik, jadi 3 slot tanpa jeda bisa memuntahkan 80-180 permintaan/menit —
 * jauh di atas 15/menit yang terukur untuk model itu. Jeda minimal mengunci
 * lajunya tanpa bergantung pada kecepatan model, yang bisa berubah lewat
 * GEMINI_MODEL.
 *
 * CATATAN: ini penjaga di sisi browser, jadi berlaku per tab. Kalau dua staf
 * memakai aplikasi bersamaan, lajunya bisa dua kali lipat — pengaman kedua ada
 * di lib/gemini.ts, yang menunggu selama retryDelay yang dikirim Google.
 */
const gerbang = batasi(2, 4200);

export default function HalamanReview() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<UiArticle[] | null>(null);
  const [kerja, setKerja] = useState<Record<string, Kerja>>({});
  const [pilihan, setPilihan] = useState<string[]>([]);
  // Himpunan, bukan satu id: editor perlu membaca beberapa ringkasan berurutan
  // untuk membandingkan. Dulu membuka yang berikutnya menutup yang sebelumnya,
  // dan itu terasa seperti aplikasinya rusak.
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const ubahTerbuka = (id: string, buka: boolean) =>
    setTerbuka((t) => {
      const baru = new Set(t);
      if (buka) baru.add(id); else baru.delete(id);
      return baru;
    });
  const [grupBuka, setGrupBuka] = useState<Record<Grup, boolean>>({ utama: true, lain: false, kurang: false });
  const [pesanSimpan, setPesanSimpan] = useState<string | null>(null);
  const [adaQueryGagal, setAdaQueryGagal] = useState(false);

  useEffect(() => {
    const mentah = sessionStorage.getItem(KUNCI.hasil);
    if (!mentah) { router.replace('/'); return; }
    setArtikel(JSON.parse(mentah));
    setAdaQueryGagal(Number(sessionStorage.getItem(KUNCI.gagal) ?? 0) > 0);
  }, [router]);

  // Nomor urut tampilan pada kartu.
  const nomorOf = useMemo(() => {
    const m = new Map<string, number>();
    artikel?.forEach((a, i) => m.set(a.id, i + 1));
    return m;
  }, [artikel]);

  const perGrup = useMemo(() => {
    const g: Record<Grup, UiArticle[]> = { utama: [], lain: [], kurang: [] };
    artikel?.forEach((a) => g[grupOf(a.score)].push(a));
    return g;
  }, [artikel]);

  // Pekerjaan yang mengantre bisa baru jalan puluhan detik kemudian — saat itu
  // `kerja` dari closure sudah basi. Ref-nya selalu yang terkini.
  const kerjaRef = useRef(kerja);
  kerjaRef.current = kerja;

  const ubah = (id: string, k: Partial<Kerja>) =>
    setKerja((s) => ({ ...s, [id]: { ...(s[id] ?? kerjaBaru()), ...k } }));

  /** Versi yang bisa membaca keadaan terkini — dipakai saat menggabung warning. */
  const ubahDari = (id: string, f: (k: Kerja) => Partial<Kerja>) =>
    setKerja((s) => {
      const kini = s[id] ?? kerjaBaru();
      return { ...s, [id]: { ...kini, ...f(kini) } };
    });

  /**
   * Beberapa artikel boleh jalan bersamaan, tapi dijaga `gerbang` supaya tidak
   * menghajar kuota Gemini. Tiap kartu tetap memperbarui progresnya sendiri.
   */
  async function proses(a: UiArticle, mulaiDari: 'resolve' | 'extract' | 'summarize' = 'resolve') {
    await gerbang(
      () => jalankan(a, mulaiDari),
      () => ubah(a.id, { tahap: 'antre', galat: {} }),
    );
  }

  /**
   * resolve → extract → summarize, satu artikel, progres kelihatan tiap tahap.
   * `mulaiDari` = 'extract' dipakai kalau user mengisi alamat beritanya sendiri —
   * resolve dilewati karena link Google-nya memang tidak bisa dipakai.
   */
  async function jalankan(a: UiArticle, mulaiDari: 'resolve' | 'extract' | 'summarize') {
    const kini = () => kerjaRef.current[a.id] ?? kerjaBaru();
    let url = kini().finalUrl;
    let teks = kini().fullText;

    if (mulaiDari === 'resolve') {
      ubah(a.id, { tahap: 'resolve', galat: {} });
      try {
        const r = await kirim<{ results: { finalUrl: string | null; error?: string }[] }>(
          '/api/resolve', { links: [a.link] });
        url = r.results[0]?.finalUrl ?? null;
        if (!url) throw new Error(r.results[0]?.error ?? 'tidak ketemu');
        ubah(a.id, { finalUrl: url });
      } catch (e) {
        ubah(a.id, { tahap: 'kosong', galat: { resolve: (e as Error).message } });
        return;
      }
    }

    if (mulaiDari === 'resolve' || mulaiDari === 'extract') {
      if (!url || !/^https?:\/\//.test(url)) {
        ubah(a.id, { tahap: 'kosong', galat: { resolve: 'alamat berita belum diisi' } });
        return;
      }
      ubah(a.id, { tahap: 'extract', galat: {} });
      try {
        const r = await kirim<{ results: { fullText: string | null; imageUrl: string | null; warnings: string[]; error?: string }[] }>(
          '/api/extract', { urls: [url] });
        const hasil = r.results[0];
        if (!hasil?.fullText) throw new Error(hasil?.error ?? 'isi artikel kosong');
        teks = hasil.fullText;
        ubah(a.id, { fullText: teks, imageUrl: hasil.imageUrl, warnings: hasil.warnings ?? [] });
      } catch (e) {
        ubah(a.id, { tahap: 'kosong', galat: { extract: (e as Error).message } });
        return;
      }
    }

    // Tanpa bahan, Gemini tidak bisa apa-apa. Katakan itu terang-terangan —
    // dulu banner diam-diam berubah jadi galat extract, dan dari sisi user
    // terlihat seperti "tombolnya tidak berfungsi".
    if (!teks?.trim()) {
      ubah(a.id, {
        tahap: 'siap',
        galat: { sumber: 'Belum ada isi artikel untuk diringkas. Tempel isi beritanya di kotak kuning di atas dulu.' },
      });
      return;
    }

    ubah(a.id, { tahap: 'summarize' });
    // Galat kuota punya kalimat sendiri yang aman ditampilkan; sisanya mentah
    // dan hanya boleh jadi catatan, bukan tulisan di layar staf.
    let pesanKuota: string | undefined;
    try {
      const r = await kirim<{ summaries: { summary: string | null; targetKata: [number, number]; warnings: string[]; error?: string; pesanUser?: string }[] }>(
        '/api/summarize', { articles: [{ title: a.title, sourceName: a.sourceName, fullText: teks }] });
      const s = r.summaries[0];
      pesanKuota = s?.pesanUser;
      if (!s?.summary) throw new Error(s?.error ?? 'ringkasan kosong');
      ubahDari(a.id, (k) => ({
        tahap: 'siap', summary: s.summary, targetKata: s.targetKata, galat: {},
        warnings: [...new Set([...k.warnings.filter((w) => w !== 'artikel-pendek'), ...s.warnings])],
      }));
    } catch (e) {
      // Ringkasan yang sudah ada JANGAN dihapus — bisa jadi itu tulisan tangan user.
      ubahDari(a.id, (k) => ({
        tahap: 'siap',
        summary: k.summary ?? '',
        galat: pesanKuota ? { kuota: pesanKuota } : { summarize: (e as Error).message },
      }));
    }
  }

  function toggle(a: UiArticle) {
    if (pilihan.includes(a.id)) {
      setPilihan((p) => p.filter((x) => x !== a.id));   // data hasil kerja disimpan, centang ulang jadi instan
      ubahTerbuka(a.id, false);                         // panelnya ikut tutup, bukan menumpuk diam-diam
      return;
    }
    setPilihan((p) => [...p, a.id]);
    ubahTerbuka(a.id, true);
    // Ref, bukan state: centang beruntun bisa dibatch React dan `kerja` jadi basi.
    if ((kerjaRef.current[a.id] ?? kerjaBaru()).tahap === 'kosong') proses(a);
  }

  const terpilih = (artikel ?? []).filter((a) => pilihan.includes(a.id));
  /**
   * Yang menentukan siap adalah ISI-nya, bukan tahap prosesnya.
   *
   * Dulu di sini ada `k.tahap !== 'siap'`. Artikel yang gagal extract berhenti
   * di tahap 'kosong' dan tidak pernah beranjak, jadi staf yang sudah menempel
   * isi dan menulis ringkasan sendiri tetap dibilang "belum siap" — jalur
   * penyelamatan untuk portal pemblokir bot (Kabar Banten, lifestyle.bisnis.com)
   * jadi percuma. Yang perlu dicegah cuma menilai kartu yang MASIH diproses.
   */
  const belumSiap = terpilih.filter((a) => {
    const k = kerja[a.id] ?? kerjaBaru();
    if (sedangProses(k.tahap)) return true;
    if (!k.summary?.trim()) return true;
    if (!/^https?:\/\//.test(k.finalUrl ?? '')) return true;
    // Artikel asli yang belum diringkas tidak boleh masuk PDF — itu hak cipta portal.
    return !cekJiplakan(k.summary, k.fullText).aman;
  });
  const bisaLanjut = terpilih.length > 0 && belumSiap.length === 0;

  function lanjut() {
    const data: ArtikelTerpilih[] = terpilih.map((a) => {
      const k = kerja[a.id]!;
      return {
        id: a.id,
        // judulBersih() di toUi() sudah membersihkan ekor nama media, tapi selalu
        // ada yang lolos — kalau staf memperbaikinya sendiri, punya staf yang menang.
        title: k.judul?.trim() || a.title,
        summary: k.summary!.trim(),
        url: k.finalUrl!,
        sourceName: a.sourceName,
        pubDate: a.pubDate,
        imageUrl: k.imageUrl,
      };
    });
    try {
      sessionStorage.setItem(KUNCI.pilihan, JSON.stringify(data));
      router.push('/preview');
    } catch {
      setPesanSimpan('Gambarnya terlalu besar untuk disimpan. Hapus atau ganti salah satu gambar dengan yang lebih kecil.');
    }
  }

  if (!artikel) return <main className="p-12 text-center text-gray-500">Memuat…</main>;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-28 pt-10">
      <StepIndicator aktif={2} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-green-900">
          ← Kembali
        </button>
        <p className="text-sm text-gray-600">
          <strong className="text-gray-900">{perGrup.utama.length}</strong> berita utama ·{' '}
          <strong className="text-gray-900">{terpilih.length}</strong> dipilih
        </p>
      </div>

      {/* Permanen, tidak bisa ditutup: user harus tahu hasilnya mungkin cacat. */}
      {adaQueryGagal && (
        <p className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
          ⚠️ Sebagian pencarian gagal — hasil mungkin tidak lengkap. Coba ulangi pencarian kalau
          berita yang kamu cari tidak ada.
        </p>
      )}

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        ⚠️ Jangan tutup tab ini sebelum selesai download.
      </p>

      {URUTAN_GRUP.map((g) => (
        <section key={g}>
          <button
            onClick={() => setGrupBuka((s) => ({ ...s, [g]: !s[g] }))}
            className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left font-semibold text-gray-900 shadow-sm"
          >
            <span>{JUDUL_GRUP[g]} <span className="font-normal text-gray-500">({perGrup[g].length})</span></span>
            <span className="text-gray-400">{grupBuka[g] ? '▴' : '▾'}</span>
          </button>

          {grupBuka[g] && (
            <ul className="mt-3 flex flex-col gap-3">
              {perGrup[g].map((a) => (
                <ArticleCard
                  key={a.id}
                  artikel={a}
                  nomor={nomorOf.get(a.id)!}
                  wakilGugus={!a.dupeOf}
                  dipilih={pilihan.includes(a.id)}
                  terbuka={terbuka.has(a.id)}
                  kerja={kerja[a.id] ?? kerjaBaru()}
                  onToggle={() => toggle(a)}
                  onBuka={() => ubahTerbuka(a.id, !terbuka.has(a.id))}
                  onUbah={(k) => ubah(a.id, k)}
                  onUlangi={() => proses(a)}
                  onAmbilUlang={() => proses(a, (kerja[a.id]?.finalUrl ? 'extract' : 'resolve'))}
                  onBuatUlangRingkasan={() => proses(a, 'summarize')}
                />
              ))}
              {perGrup[g].length === 0 && (
                <li className="rounded-lg bg-white px-4 py-6 text-center text-sm text-gray-400">Tidak ada berita.</li>
              )}
            </ul>
          )}
        </section>
      ))}

      {/* pointer-events-none WAJIB di kontainer ini.
          Kotaknya selebar halaman dan transparan, sementara tombolnya cuma
          selebar teks di tengah. Tanpa ini, seluruh pita di dasar layar
          menelan klik yang tidak kelihatan penyebabnya — tombol di panel edit
          yang kebetulan tergulir ke pita itu jadi mati total, dan staf
          mengira aplikasinya rusak.
          Yang benar-benar bisa diklik dikembalikan satu per satu. */}
      <div className="pointer-events-none sticky bottom-4 mt-4 flex flex-col items-center gap-2">
        {pesanSimpan && (
          <p className="pointer-events-auto rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800 shadow-sm">{pesanSimpan}</p>
        )}
        {terpilih.length > 0 && belumSiap.length > 0 && (
          <p className="pointer-events-auto rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
            {belumSiap.length} berita terpilih belum siap — perlu ringkasan dan link sumber.
          </p>
        )}
        {/* ring putih tebal: tombol melayang di atas teks, jadi harus terbaca
            sebagai lapisan terpisah — bukan seperti teks yang terpotong. */}
        <button
          onClick={lanjut}
          disabled={!bisaLanjut}
          className="pointer-events-auto rounded-lg bg-green-800 px-8 py-3 font-semibold text-white shadow-lg ring-4 ring-white hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          Buat Newsletter ({terpilih.length})
        </button>
      </div>
    </main>
  );
}
