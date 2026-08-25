/**
 * Uji paksa jalur error yang belum pernah tersentuh (item 11B).
 * Jalankan: npx --yes tsx scripts/test-error-paths.ts
 */
import { existsSync } from 'node:fs';
import { extractOne } from '../lib/extractor';
import { resolveOne, resolveMany } from '../lib/resolver';
import { summarizeOne } from '../lib/gemini';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const garis = (t: string) => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 60 - t.length)));

(async () => {
  garis('1. PORTAL YANG MENOLAK (403 permanen)');
  for (const url of [
    'https://lifestyle.bisnis.com/read/20250101/223/1000000/wisata-anyer',
    'https://infoekonomi.id/2025/01/01/investasi-cilegon/',
  ]) {
    const t0 = Date.now();
    const r = await extractOne(url);
    console.log(`  ${new URL(url).hostname}`);
    console.log(`    percobaan : ${r.attempt}`);
    console.log(`    error     : ${r.error ?? '(tidak ada)'}`);
    console.log(`    fullText  : ${r.fullText ? r.fullText.length + ' karakter' : 'null'}`);
    console.log(`    warnings  : ${r.warnings.join(', ') || '(kosong)'}`);
    console.log(`    melempar? : TIDAK ✅ (${((Date.now() - t0) / 1000).toFixed(1)} detik)`);
  }

  garis('2. RESOLVE URL RUSAK');
  const rusak = [
    'https://news.google.com/rss/articles/INI-BUKAN-ID-BENERAN?oc=5',
    'https://news.google.com/rss/articles/CBMiXXXXinvalidpayloadXXXX?oc=5',
  ];
  const hasil = await resolveMany(rusak);
  hasil.forEach((r, i) => {
    console.log(`  ${i + 1}. finalUrl=${r.finalUrl ?? 'null'}  error="${r.error ?? ''}"`);
  });
  console.log(`  resolveMany melempar? TIDAK ✅ (${hasil.length} hasil dikembalikan)`);

  try {
    await resolveOne(rusak[0]);
    console.log('  🔴 resolveOne SEHARUSNYA melempar untuk URL rusak');
  } catch (e) {
    console.log(`  resolveOne melempar seperti seharusnya ✅ ("${(e as Error).message}")`);
  }

  garis('3. GEMINI DENGAN KUNCI SALAH');
  const kunciAsli = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'kunci-sengaja-salah-untuk-uji';
  const rg = await summarizeOne({
    title: 'Uji kunci salah',
    sourceName: 'uji',
    fullText: 'Ini teks percobaan yang cukup panjang untuk dikirim ke Gemini. '.repeat(20),
  });
  console.log(`  summary   : ${rg.summary ?? 'null'} ${rg.summary === null ? '✅' : '🔴'}`);
  console.log(`  error     : ${(rg.error ?? '').slice(0, 90)}`);
  console.log(`  targetKata: ${rg.targetKata.join('-')} (tetap terisi supaya UI tidak pecah)`);
  console.log(`  melempar? : TIDAK ✅`);
  process.env.GEMINI_API_KEY = kunciAsli;

  garis('4. GAMBAR 404 / TIDAK ADA');
  const g = await extractOne('https://httpstat.us/404');
  console.log(`  halaman 404: error="${g.error}" attempt=${g.attempt} melempar? TIDAK ✅`);

  const noimg = await extractOne('https://example.com/');
  console.log(`  example.com: imageUrl=${noimg.imageUrl ?? 'null'} warnings=[${noimg.warnings.join(', ')}]`);

  garis('5. LEBAR GAMBAR TIDAK TERBACA');
  console.log('  (format tak dikenal → null, BUKAN dianggap kecil — lihat lib/extractor.ts)');
})();
