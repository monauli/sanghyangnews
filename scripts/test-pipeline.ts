/** Uji ulang item 3+4 sekaligus. Jalankan: npx --yes tsx scripts/test-pipeline.ts */
import { searchAll } from '../lib/googlenews';
import { filterArticles, bareTitle } from '../lib/filter';
import { scoreArticles, tierOf } from '../lib/scoring';

const WAJIB_TINGGI = ['exciting banten festival', 'aston', 'mendes', 'pesta laut', 'movenpick', 'top of mind'];
const HARUS_HILANG = ['tulungagung', 'sungai serang', 'larung sedekah', 'cipondoh', 'tangerang'];

(async () => {
  const { articles: raw } = await searchAll('2026-06-01', '2026-06-30');
  const { articles: kept, stats } = filterArticles(raw);
  const sc = scoreArticles(kept);

  console.log('  ── [1] FILTER ──');
  console.log(`  Mentah                : ${stats.raw}`);
  console.log(`  Unik                  : ${stats.unique}`);
  console.log(`  ➖ Blacklist           : ${stats.droppedBlacklist}`);
  console.log(`  ➖ Regional (luar jangkauan) : ${stats.droppedRegional}`);
  console.log(`  ➖ Lokasi tak di judul : ${stats.droppedLocation}`);
  console.log(`  ✅ LOLOS               : ${stats.kept}`);
  console.log(`  ⚠️  Ditandai mirip      : ${stats.duped}`);

  console.log('\n  ── [2] GRUP SKOR ──');
  for (const t of ['tinggi', 'sedang', 'rendah']) {
    console.log(`  ${t.padEnd(7)}: ${sc.filter((a) => tierOf(a.score) === t).length}`);
  }

  console.log('\n  ── [3] 20 TERATAS ──');
  sc.slice(0, 20).forEach((a, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${String(a.score).padStart(3)}] ${a.title.slice(0, 56)}`);
    console.log(`      📍${a.location} ${a.reasons.join(' ')}${a.dupeOf ? ' ⚠️mirip' : ''}`);
  });

  console.log('\n  ── [4] LOKASI HANYA DI NAMA SUMBER ──');
  const palsu = sc.filter((a) => !bareTitle(a.title).includes(a.location));
  console.log(`  Jumlah: ${palsu.length} ${palsu.length === 0 ? '✅' : '🔴'}`);
  palsu.slice(0, 5).forEach((a) => console.log(`   [${a.score}] ${a.title}`));

  console.log('\n  ── [5] DAFTAR WAJIB TINGGI ──');
  for (const k of WAJIB_TINGGI) {
    const m = sc.filter((a) => a.title.toLowerCase().includes(k));
    const best = m.sort((x, y) => y.score - x.score)[0];
    if (!best) { console.log(`  🔴 "${k}" — HILANG dari hasil`); continue; }
    const ok = tierOf(best.score) === 'tinggi';
    console.log(`  ${ok ? '✅' : '🔴'} [${String(best.score).padStart(3)}] ${best.title.slice(0, 56)}  (${m.length} artikel serumpun)`);
  }

  console.log('\n  ── [6] YANG HARUS HILANG ──');
  for (const k of HARUS_HILANG) {
    const m = sc.filter((a) => bareTitle(a.title).includes(k));
    console.log(`  ${m.length === 0 ? '✅' : '🔴'} "${k}": ${m.length} tersisa`);
    m.slice(0, 3).forEach((a) => console.log(`      [${a.score}] ${a.title.slice(0, 56)}`));
  }

  console.assert(palsu.length === 0, 'tidak boleh ada lokasi yang cuma cocok di nama sumber');
})();
