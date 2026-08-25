/** Uji nyata lib/resolver.ts. Jalankan: npx --yes tsx scripts/test-resolver.ts */
import { searchAll } from '../lib/googlenews';
import { filterArticles } from '../lib/filter';
import { scoreArticles } from '../lib/scoring';
import { resolveMany } from '../lib/resolver';
import { writeFileSync } from 'node:fs';

(async () => {
  const { articles: raw } = await searchAll('2026-06-01', '2026-06-30');
  const { articles } = filterArticles(raw);
  const top = scoreArticles(articles).slice(0, 8);

  const t0 = Date.now();
  const res = await resolveMany(top.map((a) => a.link));
  const detik = (Date.now() - t0) / 1000;

  res.forEach((r, i) => {
    const host = r.finalUrl ? new URL(r.finalUrl).hostname.replace('www.', '') : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${r.finalUrl ? '✅ ' + host : '❌ ' + r.error}`);
    console.log(`      ${top[i].title.slice(0, 58)}`);
  });

  const ok = res.filter((r) => r.finalUrl).length;
  console.log(`\n  Hasil  : ${ok}/${res.length}`);
  console.log(`  Waktu  : ${detik.toFixed(1)} detik (${(detik / res.length).toFixed(2)} detik/artikel)`);

  // cache: panggilan kedua harus instan
  const t1 = Date.now();
  await resolveMany(top.map((a) => a.link));
  console.log(`  Cache  : ${((Date.now() - t1) / 1000).toFixed(2)} detik untuk 8 artikel yang sama`);

  writeFileSync('scripts/.resolved.json', JSON.stringify(
    res.map((r, i) => ({ title: top[i].title, finalUrl: r.finalUrl })), null, 1));
  console.log('  → scripts/.resolved.json (dipakai uji extractor)');
})();
