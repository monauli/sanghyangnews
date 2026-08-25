/** Uji nyata lib/scoring.ts. Jalankan: npx --yes tsx scripts/test-scoring.ts */
import { searchAll } from '../lib/googlenews';
import { filterArticles } from '../lib/filter';
import { scoreArticles, tierOf } from '../lib/scoring';

// Harus masuk grup tinggi
const HARUS_TINGGI = [
  'exciting banten festival', 'aston', 'mendes', 'pesta laut', 'movenpick', 'top of mind',
];
// Harus tenggelam (skor < 3)
const HARUS_TENGGELAM = [
  'raperda', 'apbd', 'sekwan', 'monev', 'bpk', 'weekend escape', 'tempat wisata terbaik',
];

(async () => {
  const { articles: raw } = await searchAll('2026-06-01', '2026-06-30');
  const { articles: kept } = filterArticles(raw);
  const sc = scoreArticles(kept);

  const grup = (t: string) => sc.filter((a) => tierOf(a.score) === t);
  console.log(`  🟢 Tinggi (>=8) : ${grup('tinggi').length}`);
  console.log(`  🟡 Sedang (3-7) : ${grup('sedang').length}`);
  console.log(`  ⚪ Rendah (<3)  : ${grup('rendah').length}`);

  console.log('\n  ── 20 TERATAS ──');
  sc.slice(0, 20).forEach((a, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${String(a.score).padStart(3)}] ${a.title.slice(0, 58)}`);
    console.log(`      📍${a.location} ${a.reasons.join(' ')}${a.dupeOf ? ` ⚠️mirip:${a.dupeOf.slice(0, 8)}` : ''}`);
  });

  console.log('\n  ── 8 TERBAWAH ──');
  sc.slice(-8).forEach((a) => {
    console.log(`      [${String(a.score).padStart(3)}] ${a.title.slice(0, 58)}`);
    console.log(`            ${a.reasons.join(' ')}`);
  });

  const find = (k: string) => sc.filter((a) => a.title.toLowerCase().includes(k));
  console.log('\n  ── CEK DAFTAR WAJIB TINGGI ──');
  for (const k of HARUS_TINGGI) {
    const m = find(k);
    if (!m.length) { console.log(`  ❓ "${k}" — tidak ditemukan sama sekali`); continue; }
    for (const a of m) {
      const ok = tierOf(a.score) === 'tinggi';
      console.log(`  ${ok ? '✅' : '🔴'} [${String(a.score).padStart(3)}] ${a.title.slice(0, 54)}`);
      if (!ok) console.log(`         ${a.reasons.join(' ')}`);
    }
  }

  console.log('\n  ── CEK DAFTAR WAJIB TENGGELAM ──');
  for (const k of HARUS_TENGGELAM) {
    const m = find(k);
    if (!m.length) { console.log(`  ·  "${k}" — tidak ada di hasil bulan ini`); continue; }
    for (const a of m) {
      const ok = a.score < 3;
      console.log(`  ${ok ? '✅' : '🔴'} [${String(a.score).padStart(3)}] ${a.title.slice(0, 54)}`);
      if (!ok) console.log(`         ${a.reasons.join(' ')}`);
    }
  }

  // cek arah penanda duplikat
  const rank = new Map(sc.map((a, i) => [a.id, i]));
  const salah = sc.filter((a) => a.dupeOf && rank.get(a.id)! < rank.get(a.dupeOf)!);
  console.log(`\n  Ditandai mirip: ${sc.filter((a) => a.dupeOf).length}, arah salah: ${salah.length}`);
  console.assert(salah.length === 0, 'dupeOf harus selalu menunjuk ke artikel yang skornya lebih tinggi');
  console.assert(sc.every((a, i) => i === 0 || sc[i - 1].score >= a.score), 'harus urut skor menurun');
})();
