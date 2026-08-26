/**
 * Template newsletter — SATU sumber untuk preview di browser DAN untuk Puppeteer.
 * Kalau dipisah, preview dan PDF akan berbeda diam-diam.
 *
 * Aturan yang tidak boleh dilanggar (semuanya dari error nyata di PDF referensi klien):
 *  1. Tanggal Bahasa Indonesia penuh — nama hari DAN nama bulan. Bukan "Kamis, 25 June".
 *  2. Gambar di-embed base64 (dikerjakan /api/export), bukan URL eksternal.
 *  3. Font sistem saja. Google Fonts sering belum termuat saat Puppeteer mencetak.
 *  4. URL sumber wajib ada di setiap artikel — syarat legal, bukan hiasan.
 */
import { tanggalPanjang, periodeEdisi } from '@/lib/ui';

/** Rentang tanggal berita yang dicari user. Null = tidak diketahui, baris Edisi disembunyikan. */
export type Periode = { dari: string; sampai: string } | null;

export type ArtikelNewsletter = {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  imageUrl: string | null;
};

/** Judul & ringkasan bisa diedit user — jangan pernah masuk HTML mentah-mentah. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const GAYA = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Tahoma, Arial, Helvetica, sans-serif;
    color: #1f2937;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .kop {
    display: flex; justify-content: space-between; align-items: flex-end;
    gap: 8mm; padding: 16mm 15mm 5mm; font-size: 10pt; color: #4b5563;
  }
  .kop .edisi { font-weight: 700; color: #14532d; }
  .kop .terbit { margin-top: 1.2mm; font-size: 9.5pt; }
  /* Nowrap supaya merek tidak pernah patah dua baris saat edisinya panjang. */
  .kop .merek { font-weight: 700; color: #14532d; letter-spacing: .3px; white-space: nowrap; }
  .garis { height: 1px; background: #cbd5c0; margin: 0 15mm; }
  .kepala { padding: 9mm 15mm 0; }
  .kepala .baris1 { font-style: italic; font-size: 15pt; color: #4d7c0f; }
  .kepala .baris2 {
    font-size: 21pt; font-weight: 800; color: #14532d;
    line-height: 1.25; margin-top: 2mm; max-width: 150mm;
  }
  .isi { padding: 0 15mm 20mm; }
  .artikel {
    display: flex; gap: 8mm; align-items: flex-start;
    padding-top: 11mm; break-inside: avoid; page-break-inside: avoid;
  }
  .artikel.balik { flex-direction: row-reverse; }
  .artikel .gambar {
    width: 68mm; height: 46mm; flex: 0 0 68mm;
    object-fit: cover; border-radius: 2mm; background: #e5e7eb;
  }
  .artikel .kosong {
    display: flex; align-items: center; justify-content: center;
    font-size: 9pt; color: #9ca3af;
  }
  .artikel .teks { flex: 1 1 auto; min-width: 0; }
  /* Sengaja jauh lebih kecil dari judulnya — penanda urutan, bukan headline. */
  .artikel .nomor {
    font-size: 8pt; font-weight: 700; letter-spacing: .8px;
    text-transform: uppercase; color: #4d7c0f; margin-bottom: 1.5mm;
  }
  .artikel h2 { margin: 0 0 3mm; font-size: 13pt; line-height: 1.35; color: #14532d; }
  .artikel p { margin: 0 0 2.5mm; font-size: 10pt; line-height: 1.6; text-align: justify; }
  .sumber {
    display: block; margin-top: 3mm; font-size: 8.5pt; font-style: italic;
    text-decoration: underline; color: #b45309; word-break: break-all;
  }
  /* Maksimal 2 artikel per halaman. */
  .artikel:nth-of-type(2n):not(:last-child) { break-after: page; page-break-after: always; }
  .kaki { font-size: 9pt; color: #4b5563; text-align: right; padding: 0 15mm 10mm; }
  /* Di PDF footer harus muncul di tiap halaman; di layar cukup di bawah
     supaya tidak melayang menimpa artikel. */
  @media print {
    .kaki { position: fixed; bottom: 9mm; right: 15mm; padding: 0; }
  }
`;

function satuArtikel(a: ArtikelNewsletter, i: number): string {
  const gambar = a.imageUrl
    ? `<img class="gambar" src="${esc(a.imageUrl)}" alt="">`
    : `<div class="gambar kosong">tanpa gambar</div>`;
  const paragraf = a.summary
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

  return `
    <article class="artikel${i % 2 === 1 ? ' balik' : ''}">
      ${gambar}
      <div class="teks">
        <div class="nomor">Berita ${i + 1}</div>
        <h2>${esc(a.title)}</h2>
        ${paragraf}
        <a class="sumber" href="${esc(a.url)}">${esc(a.url)}</a>
      </div>
    </article>`;
}

export function renderNewsletter(
  publishDate: string,
  articles: ArtikelNewsletter[],
  periode: Periode = null,
): string {
  const edisi = periode ? periodeEdisi(periode.dari, periode.sampai) : '';
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Sanghyang Highlights</title>
<style>${GAYA}</style>
</head>
<body>
  <div class="kop">
    <div>
      ${edisi ? `<div class="edisi">Edisi ${esc(edisi)}</div>` : ''}
      <div class="terbit">Terbit: ${esc(tanggalPanjang(publishDate))}</div>
    </div>
    <span class="merek">Sanghyang news</span>
  </div>
  <div class="garis"></div>
  <div class="kepala">
    <div class="baris1">Sanghyang Highlights</div>
    <div class="baris2">Stay connected with the latest news and updates</div>
  </div>
  <div class="isi">
    ${articles.map(satuArtikel).join('')}
  </div>
  <div class="kaki">www.sanghyang.com</div>
</body>
</html>`;
}
