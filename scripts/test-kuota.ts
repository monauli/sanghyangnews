/**
 * Ukur batas HARIAN model Gemini yang sebenarnya.
 * Angka resmi Google tidak cocok dengan yang dialami akun ini, jadi diukur sendiri.
 *
 * Jalankan: npx --yes tsx scripts/test-kuota.ts [nama-model] [maks-percobaan]
 *   npx --yes tsx scripts/test-kuota.ts gemini-2.5-flash-lite
 *
 * Promptnya sengaja sangat pendek supaya yang habis kuota permintaan, bukan token.
 */
import { existsSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const MODEL = process.argv[2] || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const MAKS = Number(process.argv[3] || 120);
// Default 4,5 detik = ~13/menit. Harus di BAWAH batas per-menit, kalau tidak yang
// kepentok duluan itu RPM dan batas hariannya tidak pernah kelihatan.
const JEDA = Number(process.argv[4] || 4500);
const PROMPT = 'Balas satu kata: ok';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ambil angka & quotaId dari badan error Google, apa adanya. */
function bedah(pesan: string) {
  const ambil = (pola: RegExp) => (pesan.match(pola) ?? [])[1] ?? null;
  return {
    limit: ambil(/"?limit"?[:\s]+"?(\d+)/i),
    quotaId: ambil(/"quotaId"\s*:\s*"([^"]+)"/),
    metric: ambil(/"quotaMetric"\s*:\s*"([^"]+)"/),
    retryDelay: ambil(/"retryDelay"\s*:\s*"([^"]+)"/),
  };
}

(async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.log('  🔴 GEMINI_API_KEY tidak ada'); process.exit(1); }

  console.log(`  Model    : ${MODEL}`);
  console.log(`  Maks uji : ${MAKS} panggilan, prompt "${PROMPT}"`);
  console.log(`  Mulai    : ${new Date().toLocaleString('id-ID')}\n`);

  const ai = new GoogleGenAI({ apiKey });
  let berhasil = 0;
  const t0 = Date.now();

  for (let i = 1; i <= MAKS; i++) {
    try {
      await ai.models.generateContent({ model: MODEL, contents: PROMPT });
      berhasil++;
      if (i % 5 === 0 || i <= 3) console.log(`  ${String(i).padStart(3)}. ✅ (${berhasil} berhasil)`);
    } catch (e) {
      const pesan = (e as Error).message ?? String(e);
      const kena429 = /429|RESOURCE_EXHAUSTED|quota/i.test(pesan);
      const b0 = bedah(pesan);

      // Batas per-MENIT bukan yang dicari: tunggu, lalu lanjut. Yang mengakhiri
      // pengukuran cuma batas HARIAN (atau galat lain).
      if (kena429 && /PerMinute/i.test(b0.quotaId ?? '')) {
        const tunggu = Number((b0.retryDelay ?? '30s').replace(/\D/g, '')) + 5;
        console.log(`  ${String(i).padStart(3)}. ⏳ kena batas per-menit (${b0.limit}/menit), tunggu ${tunggu}s lalu lanjut`);
        await sleep(tunggu * 1000);
        i--;   // ulangi panggilan ini
        continue;
      }

      console.log(`\n  ${String(i).padStart(3)}. ${kena429 ? '🔴 KENA 429' : '🔴 GALAT LAIN'}`);
      console.log(`\n  ── ANGKA ──`);
      console.log(`  Berhasil sebelum gagal : ${berhasil}`);
      console.log(`  Gagal di panggilan ke  : ${i}`);
      console.log(`  Lama                   : ${((Date.now() - t0) / 1000).toFixed(1)} detik`);
      const b = bedah(pesan);
      console.log(`  limit yang disebut     : ${b.limit ?? '(tidak disebut)'}`);
      console.log(`  quotaId                : ${b.quotaId ?? '(tidak disebut)'}`);
      console.log(`  quotaMetric            : ${b.metric ?? '(tidak disebut)'}`);
      console.log(`  retryDelay             : ${b.retryDelay ?? '(tidak disebut)'}`);
      console.log(`\n  ── PESAN MENTAH DARI GOOGLE ──\n${pesan}`);
      return;   // bukan process.exit(): SDK masih punya handle terbuka, libuv protes
    }
    await sleep(1500);   // 40/menit — di bawah batas per-menit, biar yang kepentok batas HARIAN
  }

  console.log(`\n  ✅ ${MAKS} panggilan lolos tanpa 429 dalam ${((Date.now() - t0) / 1000).toFixed(1)} detik.`);
  console.log(`  Batas hariannya lebih besar dari ${MAKS} — naikkan angka maks kalau mau dipastikan.`);
})();
