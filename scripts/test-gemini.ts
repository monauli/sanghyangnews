/**
 * Uji nyata lib/gemini.ts — 3 artikel beda tema.
 * Butuh GEMINI_API_KEY di .env.local
 * Jalankan: npx --yes tsx scripts/test-gemini.ts
 */
import { existsSync } from 'node:fs';
import { searchAll } from '../lib/googlenews';
import { filterArticles } from '../lib/filter';
import { scoreArticles } from '../lib/scoring';
import { resolveMany } from '../lib/resolver';
import { extractOne } from '../lib/extractor';
import { summarizeOne, model } from '../lib/gemini';
import { buangKutipan } from '../lib/jiplak';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

// satu acara, satu hotel/resort, satu kebijakan
const TEMA: [string, string][] = [
  ['acara', 'exciting banten festival'],
  ['hotel/resort', 'movenpick'],
  ['kebijakan', 'mendes'],
];

const kata = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const bersihkan = (s: string) => kata(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' '));

/**
 * Rentang verbatim UTUH (bukan jendela geser — angkanya menggelembung dan menyesatkan).
 * Tiap rentang dilaporkan sekali dengan panjang sebenarnya.
 */
function rentangSalinan(ringkasan: string, asli: string, n = 8) {
  // Isi kutipan berpetik dikecualikan — aturan 5 mengizinkannya, dan kalau ikut
  // dihitung tiap kutipan sah jadi alarm palsu. Sama seperti lib/jiplak.ts.
  const a = bersihkan(buangKutipan(ringkasan));
  const b = bersihkan(asli);
  const indeks = new Set<string>();
  for (let i = 0; i + n <= b.length; i++) indeks.add(b.slice(i, i + n).join(' '));

  const out: { panjang: number; teks: string }[] = [];
  let i = 0;
  while (i + n <= a.length) {
    if (!indeks.has(a.slice(i, i + n).join(' '))) { i++; continue; }
    let akhir = i + n;
    while (akhir < a.length && indeks.has(a.slice(akhir - n + 1, akhir + 1).join(' '))) akhir++;
    out.push({ panjang: akhir - i, teks: a.slice(i, akhir).join(' ') });
    i = akhir;
  }
  return out.sort((x, y) => y.panjang - x.panjang);
}

/**
 * Berapa kata pertama ringkasan yang sama persis dengan kata pertama artikel.
 * Aturan 1 di prompt melarang memulai dari kalimat pembuka sumber.
 */
function pembukaSama(ringkasan: string, asli: string): number {
  const a = bersihkan(ringkasan);
  const b = bersihkan(asli);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

(async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.log('  ❌ GEMINI_API_KEY belum ada. Isi di .env.local dulu.');
    process.exit(1);
  }

  const { articles: raw } = await searchAll('2026-06-01', '2026-06-30');
  const { articles } = filterArticles(raw);
  const sc = scoreArticles(articles);

  const pilihan = TEMA.map(([label, kunci]) => {
    const a = sc.find((x) => x.title.toLowerCase().includes(kunci));
    return a ? { label, a } : null;
  }).filter((x) => x !== null);

  console.log(`  Model           : ${model()}`);
  console.log(`  Artikel terpilih: ${pilihan.map((p) => p.label).join(', ')}\n`);

  const resolved = await resolveMany(pilihan.map((p) => p.a.link));

  let totalPotong = 0;
  for (const [i, p] of pilihan.entries()) {
    const url = resolved[i].finalUrl;
    console.log('═'.repeat(74));
    console.log(`  [${p.label.toUpperCase()}] ${p.a.title}`);
    console.log(`  ${url ?? '(gagal resolve: ' + resolved[i].error + ')'}`);
    console.log('═'.repeat(74));
    if (!url) continue;

    const ex = await extractOne(url);
    if (!ex.fullText) { console.log(`  ❌ gagal ambil isi: ${ex.error ?? ex.warnings.join(',')}\n`); continue; }
    const kataSumber = kata(ex.fullText).length;

    const t0 = Date.now();
    const r = await summarizeOne({ title: p.a.title, sourceName: p.a.sourceName, fullText: ex.fullText });
    const detik = (Date.now() - t0) / 1000;

    console.log(`  Artikel asli : ${kataSumber} kata`);
    console.log(`  Target kata  : ${r.targetKata[0]}-${r.targetKata[1]}${r.warnings.length ? '  ⚠️ ' + r.warnings.join(',') : ''}\n`);
    if (!r.summary) { console.log(`  ❌ ${r.error}\n`); continue; }

    console.log('  ── RINGKASAN ──');
    console.log(r.summary.split('\n').map((b) => '  ' + b).join('\n'));

    const jml = kata(r.summary).length;
    const [lo, hi] = r.targetKata;
    const rentang = rentangSalinan(r.summary, ex.fullText);
    totalPotong += r.dibuangSanitizer.length;

    console.log('\n  ── PENILAIAN ──');
    console.log(`  Jumlah kata : ${jml} ${jml >= lo && jml <= hi ? '✅' : `🔴 (target ${lo}-${hi})`}`);
    console.log(`  Waktu       : ${detik.toFixed(1)} detik`);
    console.log(`  Sanitizer   : ${r.dibuangSanitizer.length ? '🔴 memotong ' + r.dibuangSanitizer.length + ' baris' : '✅ tidak memotong apa pun'}`);
    r.dibuangSanitizer.forEach((b) => console.log(`                ✂️  "${b.slice(0, 90)}"`));

    const total = rentang.reduce((n, x) => n + x.panjang, 0);
    const mentah = rentangSalinan(r.summary.replace(/["“”]/g, ''), ex.fullText);
    console.log(`  Rentang verbatim >=8 kata : ${rentang.length} buah, terpanjang ${rentang[0]?.panjang ?? 0} kata  (kutipan dikecualikan)`);
    console.log(`   pembanding tanpa pengecualian : terpanjang ${mentah[0]?.panjang ?? 0} kata`);
    console.log(`  Total kata terjiplak      : ${total}/${jml} (${Math.round((total / jml) * 100)}%)`);
    rentang.slice(0, 4).forEach((x) => console.log(`   ${String(x.panjang).padStart(2)} kata: "${x.teks}"`));

    const pembuka = pembukaSama(r.summary, ex.fullText);
    console.log(`  Menyalin kalimat pembuka  : ${pembuka >= 8 ? `🔴 ${pembuka} kata pertama sama` : `✅ tidak (cocok ${pembuka} kata pertama saja)`}`);
    console.log(`   awal sumber   : "${bersihkan(ex.fullText).slice(0, 16).join(' ')}…"`);
    console.log(`   awal ringkasan: "${bersihkan(r.summary).slice(0, 16).join(' ')}…"`);

    // Dibaca manual untuk cek kalimat karangan & ejaan institusi — tidak bisa diotomatiskan.
    console.log('\n  ── SUMBER (600 kata pertama, untuk cek fakta) ──');
    console.log('  ' + kata(ex.fullText).slice(0, 600).join(' ').replace(/(.{110}\s)/g, '$1\n  '));
    console.log('');
  }

  console.log('═'.repeat(74));
  console.log(`  Sanitizer memotong sesuatu: ${totalPotong} kali dari ${pilihan.length} artikel`);
})();
