/**
 * Uji tata letak newsletter: artikel tanpa gambar dan pola selang-seling.
 * Murni template, tidak memanggil API apa pun.
 * Jalankan: npx --yes tsx scripts/test-tataletak.ts
 */
import { renderNewsletter, type ArtikelNewsletter } from '../templates/newsletter';

let gagal = 0;
const cek = (ok: boolean, label: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}`);
};

const artikel = (n: number, adaGambar: boolean): ArtikelNewsletter => ({
  title: `Judul artikel ${n}`,
  summary: `Ringkasan artikel ${n}.`,
  url: `https://contoh.test/berita-${n}`,
  sourceName: 'Uji',
  imageUrl: adaGambar ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : null,
});

/** Baca tiap <article>: punya gambar atau tidak, dan di sisi mana. */
function bedah(pola: boolean[]) {
  const html = renderNewsletter('2026-08-26', pola.map((g, i) => artikel(i + 1, g)),
    { dari: '2026-07-01', sampai: '2026-07-31' });
  return [...html.matchAll(/<article class="artikel([^"]*)">([\s\S]*?)<\/article>/g)].map((m) => {
    const bergambar = m[2].includes('<img class="gambar"');
    return {
      bergambar,
      sisi: !bergambar ? 'penuh' : m[1].includes('balik') ? 'kanan' : 'kiri',
      nomor: (m[2].match(/<div class="nomor">Berita (\d+)<\/div>/) ?? [])[1],
    };
  });
}

const gambarkan = (h: ReturnType<typeof bedah>) =>
  h.map((a) => `${a.nomor}:${a.sisi}`).join('  ');

const KASUS: [string, boolean[], string[]][] = [
  ['semua bergambar', [true, true, true, true], ['kiri', 'kanan', 'kiri', 'kanan']],
  ['tanpa gambar di AWAL', [false, true, true], ['penuh', 'kiri', 'kanan']],
  ['tanpa gambar di TENGAH', [true, false, true], ['kiri', 'penuh', 'kanan']],
  ['tanpa gambar di AKHIR', [true, true, false], ['kiri', 'kanan', 'penuh']],
  ['dua tanpa gambar beruntun di awal', [false, false, true, true], ['penuh', 'penuh', 'kiri', 'kanan']],
  ['selang-seling dengan yang kosong', [true, false, true, false, true], ['kiri', 'penuh', 'kanan', 'penuh', 'kiri']],
  ['SEMUA tanpa gambar', [false, false, false], ['penuh', 'penuh', 'penuh']],
  // Susunan persis fixture test-export.ts, supaya uji cepat ini dan uji PDF sejalan.
  ['susunan fixture PDF', [false, true, false, false], ['penuh', 'kiri', 'penuh', 'penuh']],
  ['satu artikel saja, bergambar', [true], ['kiri']],
  ['satu artikel saja, tanpa gambar', [false], ['penuh']],
];

for (const [label, pola, harap] of KASUS) {
  const h = bedah(pola);
  const sisi = h.map((a) => a.sisi);
  console.log(`\n  ${label}`);
  console.log(`    ${gambarkan(h)}`);
  cek(sisi.join(',') === harap.join(','), `sisi: ${harap.join(', ')}`);
  cek(h.map((a) => a.nomor).join(',') === pola.map((_, i) => i + 1).join(','),
    'penomoran tetap berurutan 1..n (tidak ikut terpengaruh gambar)');
}

console.log('\n  ── KOTAK "tanpa gambar" HARUS SUDAH TIDAK ADA ──');
const html = renderNewsletter('2026-08-26', [artikel(1, false), artikel(2, true)], null);
cek(!html.includes('tanpa gambar'), 'tidak ada tulisan "tanpa gambar" di keluaran');
cek(!html.includes('class="gambar kosong"'), 'tidak ada kotak abu-abu kosong');
cek(!/\.kosong\s*\{/.test(html), 'gaya .kosong yang tak terpakai sudah dibuang');
cek((html.match(/<img class="gambar"/g) ?? []).length === 1, 'cuma artikel bergambar yang punya <img>');

console.log('\n  ── PREVIEW DAN PDF PAKAI KELUARAN YANG SAMA ──');
const a = renderNewsletter('2026-08-26', [artikel(1, false), artikel(2, true)], { dari: '2026-07-01', sampai: '2026-07-31' });
const b = renderNewsletter('2026-08-26', [artikel(1, false), artikel(2, true)], { dari: '2026-07-01', sampai: '2026-07-31' });
cek(a === b, 'renderNewsletter() deterministik — satu sumber untuk keduanya');

console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
process.exit(gagal === 0 ? 0 : 1);
