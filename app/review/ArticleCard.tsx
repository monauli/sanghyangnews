'use client';

import { useRef, useState } from 'react';
import { badge, tanggalPendek, type UiArticle } from '@/lib/ui';
import { cekJiplakan } from '@/lib/jiplak';

export type Kerja = {
  tahap: 'kosong' | 'antre' | 'resolve' | 'extract' | 'summarize' | 'siap';
  finalUrl: string | null;
  fullText: string | null;
  imageUrl: string | null;
  summary: string | null;
  targetKata: [number, number] | null;
  warnings: string[];
  galat: { resolve?: string; extract?: string; summarize?: string; sumber?: string; kuota?: string };
};

export const kerjaBaru = (): Kerja => ({
  tahap: 'kosong', finalUrl: null, fullText: null, imageUrl: null,
  summary: null, targetKata: null, warnings: [], galat: {},
});

/**
 * Sedang dikerjakan mesin — kartunya belum bisa dinilai.
 * 'kosong' TIDAK termasuk: itu juga keadaan artikel yang gagal extract dan
 * berhenti di situ selamanya. Menyamakannya dengan "belum siap" adalah bug
 * yang membuat artikel dari portal pemblokir bot tidak pernah bisa masuk PDF
 * walaupun stafnya sudah menempel isi dan menulis ringkasan sendiri.
 */
export const sedangProses = (tahap: Kerja['tahap']) => tahap !== 'kosong' && tahap !== 'siap';

const PESAN_TAHAP: Record<Kerja['tahap'], string> = {
  kosong: '',
  antre: 'Menunggu giliran…',
  resolve: 'Mengambil link…',
  extract: 'Membaca artikel…',
  summarize: 'Merangkum… (biasanya 10-40 detik)',
  siap: '',
};

const MAKS_UPLOAD = 5 * 1024 * 1024;

const hitungKata = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Domain tetap utuh di depan, ekor alamatnya yang dipotong. */
function pendekUrl(u: string): string {
  try {
    const { hostname, pathname } = new URL(u);
    const h = hostname.replace(/^www\./, '');
    const p = pathname.replace(/\/+$/, '');
    return p.length > 42 ? h + p.slice(0, 41) + '…' : h + p;
  } catch {
    return u;
  }
}

type Props = {
  artikel: UiArticle;
  nomor: number;
  nomorMirip: number | null;
  dipilih: boolean;
  terbuka: boolean;
  kerja: Kerja;
  onToggle: () => void;
  onBuka: () => void;
  onUbah: (k: Partial<Kerja>) => void;
  onUlangi: () => void;
  onAmbilUlang: () => void;
  onBuatUlangRingkasan: () => void;
};

export default function ArticleCard({
  artikel, nomor, nomorMirip, dipilih, terbuka, kerja,
  onToggle, onBuka, onUbah, onUlangi, onAmbilUlang, onBuatUlangRingkasan,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ubahLink, setUbahLink] = useState(false);
  const sibuk = sedangProses(kerja.tahap);
  const adaGalat = Object.values(kerja.galat).some(Boolean);
  const jiplak = cekJiplakan(kerja.summary ?? '', kerja.fullText);

  function unggahGambar(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return alert('Pakai file JPG, PNG, atau WEBP.');
    if (f.size > MAKS_UPLOAD) return alert('Ukuran gambar maksimal 5 MB.');
    const r = new FileReader();
    r.onload = () => onUbah({ imageUrl: String(r.result) });
    r.readAsDataURL(f);
  }

  return (
    <li className={`rounded-xl border bg-white ${dipilih ? 'border-green-700 ring-1 ring-green-700' : 'border-gray-200'}`}>
      <div className="flex gap-4 p-4">
        <input
          type="checkbox"
          checked={dipilih}
          onChange={onToggle}
          className="mt-1 h-5 w-5 shrink-0 accent-green-800"
          aria-label={`Pilih ${artikel.title}`}
        />

        {kerja.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kerja.imageUrl}
            alt=""
            onError={() => onUbah({ imageUrl: null })}
            className="h-20 w-28 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
            {dipilih ? 'tanpa gambar' : ' '}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-gray-900">
            <span className="text-gray-400">{nomor}.</span> {artikel.title}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {artikel.sourceName} · {tanggalPendek(artikel.pubDate)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {badge(artikel.reasons).map((b) => (
              <span key={b} className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-900">{b}</span>
            ))}
            {nomorMirip && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
                ⚠️ Mirip dengan berita #{nomorMirip}
              </span>
            )}
            {kerja.warnings.includes('artikel-pendek') && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
                ⚠️ Sumber terbatas
              </span>
            )}
            {kerja.warnings.includes('gambar-kecil') && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
                ⚠️ Gambar resolusi rendah
              </span>
            )}
          </div>

          {sibuk && (
            <p className="mt-2 flex items-center gap-2 text-sm text-green-800">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-green-800 border-t-transparent" />
              {PESAN_TAHAP[kerja.tahap]}
            </p>
          )}

          {adaGalat && !sibuk && <Galat kerja={kerja} onUlangi={onUlangi} />}

          {dipilih && !sibuk && (
            <button
              type="button"
              onClick={onBuka}
              className="mt-2 text-sm font-medium text-green-800 hover:underline"
            >
              {terbuka ? 'Tutup' : 'Lihat & Edit'} {terbuka ? '▴' : '▾'}
            </button>
          )}
        </div>
      </div>

      {dipilih && terbuka && (
        <div className="flex flex-col gap-4 border-t border-gray-100 bg-gray-50 p-4">
          {/* Jalur isi-sendiri WAJIB tetap ada — kalau resolve gagal, ini satu-satunya
              cara user memberi alamat berita. Cukup disembunyikan di balik "Ubah",
              dan terbuka otomatis selama alamatnya memang belum ada. */}
          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Link sumber
            {kerja.finalUrl ? (
              <div className="flex items-center gap-2">
                <a
                  href={kerja.finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate font-normal text-green-800 underline hover:text-green-900"
                >
                  {pendekUrl(kerja.finalUrl)}
                </a>
                <button
                  type="button"
                  onClick={() => setUbahLink((v) => !v)}
                  className="shrink-0 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 hover:border-green-800 hover:text-green-900"
                >
                  {ubahLink ? 'Tutup' : 'Ubah'}
                </button>
              </div>
            ) : (
              <span className="text-xs font-normal text-amber-800">
                Belum ada. Buka beritanya, salin alamatnya, tempel di sini.
              </span>
            )}
            {(ubahLink || !kerja.finalUrl) && (
              <input
                value={kerja.finalUrl ?? ''}
                onChange={(e) => onUbah({ finalUrl: e.target.value, galat: { ...kerja.galat, resolve: undefined } })}
                placeholder="https://…"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal text-gray-900"
              />
            )}
          </div>

          {/* DI ATAS Ringkasan, bukan di dasar panel. Sebelumnya kotak ini terkubur
              di bawah pengaturan gambar, sementara kotak Ringkasan besar dan menonjol
              persis di tengah — teks artikel jadi mudah tertempel ke kotak yang salah
              dan lolos ke PDF tanpa pernah lewat Gemini. */}
          {(!kerja.fullText || kerja.galat.extract) && (
            <label className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
              1. Tempel isi beritanya di sini
              <span className="text-xs font-normal text-amber-800">
                Buka beritanya, salin isinya, tempel di kotak ini — lalu tekan{' '}
                <strong>Buat Ulang Ringkasan</strong>. Jangan tempel ke kotak Ringkasan:
                isinya harus diringkas dulu, bukan disalin apa adanya.
              </span>
              <textarea
                value={kerja.fullText ?? ''}
                onChange={(e) => onUbah({ fullText: e.target.value, galat: { ...kerja.galat, sumber: undefined } })}
                rows={5}
                placeholder="Tempel isi berita aslinya di sini…"
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-normal text-gray-900"
              />
            </label>
          )}

          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            <div className="flex items-baseline justify-between">
              <span>{kerja.fullText ? 'Ringkasan' : '2. Ringkasan'}</span>
              <span className="text-xs font-normal text-gray-500">
                {hitungKata(kerja.summary ?? '')} kata
                {kerja.targetKata && ` · target ${kerja.targetKata[0]}-${kerja.targetKata[1]}`}
              </span>
            </div>
            <textarea
              value={kerja.summary ?? ''}
              onChange={(e) => onUbah({ summary: e.target.value })}
              rows={8}
              placeholder={kerja.galat.summarize ? 'Silakan tulis manual.' : 'Ringkasan akan muncul di sini.'}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal leading-relaxed text-gray-900"
            />
            {kerja.warnings.includes('artikel-pendek') && (
              <p className="text-xs font-normal text-amber-800">
                ⚠️ Sumber terbatas, mohon periksa lebih teliti.
              </p>
            )}

            {!jiplak.aman && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-normal text-red-800">
                🔴 <strong>Ini masih artikel asli, bukan ringkasan.</strong> {jiplak.alasan}{' '}
                Menerbitkannya melanggar hak cipta portal. Tekan{' '}
                <strong>Buat Ulang Ringkasan</strong> supaya diringkas dulu, atau tulis
                ulang dengan kalimat sendiri.
              </p>
            )}

            {kerja.galat.sumber && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-normal text-amber-900">
                ⚠️ {kerja.galat.sumber}
              </p>
            )}
            {/* Dua tombol ini harus SELALU ada selama kartu terpilih. Sebelumnya
                jalan keluarnya cuma di banner error, dan banner itu hilang begitu
                user mengetik di kolom link — kartunya jadi buntu tanpa penjelasan. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onBuatUlangRingkasan}
                className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-green-800 hover:text-green-900"
              >
                Buat Ulang Ringkasan
              </button>
              <button
                type="button"
                onClick={onAmbilUlang}
                className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-green-800 hover:text-green-900"
              >
                Ambil Ulang dari Link
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm font-medium text-gray-700">
            Gambar
            {kerja.warnings.includes('gambar-kecil') && (
              <p className="text-xs font-normal text-amber-800">
                ⚠️ Gambar beresolusi rendah, sebaiknya diganti.
              </p>
            )}
            <div className="flex items-center gap-3">
              {kerja.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={kerja.imageUrl}
                  alt=""
                  onError={() => onUbah({ imageUrl: null })}
                  className="h-24 w-36 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-24 w-36 items-center justify-center rounded-lg bg-gray-200 text-xs font-normal text-gray-500">
                  belum ada gambar
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => unggahGambar(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:border-green-800"
              >
                {kerja.imageUrl ? 'Ganti' : 'Upload gambar'}
              </button>
              {kerja.imageUrl && (
                <button
                  type="button"
                  onClick={() => onUbah({ imageUrl: null })}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-red-400 hover:text-red-700"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

        </div>
      )}
    </li>
  );
}

function Galat({ kerja, onUlangi }: { kerja: Kerja; onUlangi: () => void }) {
  const { resolve, extract, summarize, sumber, kuota } = kerja.galat;
  // `kuota` sudah berupa kalimat siap tampil dari lib/gemini.ts — dipakai apa
  // adanya supaya staf tahu bedanya "tunggu sebentar" dan "coba lagi besok".
  const pesan = resolve
    ? 'Link belum bisa dipastikan.'
    : extract
      ? 'Situs ini tidak bisa dibaca otomatis.'
      : sumber
        ? 'Belum ada isi artikel untuk diringkas.'
        : kuota
          ? kuota
          : summarize
            ? 'Gagal merangkum. Silakan tulis manual.'
            : 'Gagal memuat.';
  const jalanKeluar = resolve
    ? 'Buka panel di bawah dan isi alamat beritanya.'
    : extract || sumber
      ? 'Buka panel di bawah dan tempel isi beritanya di kotak kuning.'
      : kuota
        ? 'Sementara itu, ringkasannya bisa ditulis sendiri di panel bawah.'
        : 'Buka panel di bawah dan tulis ringkasannya.';

  return (
    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-medium">⚠️ {pesan}</p>
      <p className="mt-0.5 text-amber-800">{jalanKeluar}</p>
      <button type="button" onClick={onUlangi} className="mt-1 font-medium underline">
        Coba Lagi
      </button>
    </div>
  );
}
