/** Uji nyata lib/extractor.ts. Jalankan test-resolver.ts dulu. */
import { readFileSync } from 'node:fs';
import { extractMany } from '../lib/extractor';

(async () => {
  const src: { title: string; finalUrl: string | null }[] =
    JSON.parse(readFileSync('scripts/.resolved.json', 'utf8'));
  const urls = src.filter((s) => s.finalUrl).map((s) => s.finalUrl!);

  const t0 = Date.now();
  const res = await extractMany(urls);

  console.log('  portal                        teks  gambar  lebar  percobaan');
  console.log('  ' + '─'.repeat(72));
  for (const r of res) {
    const host = new URL(r.url).hostname.replace('www.', '');
    const teks = r.error ? `❌ ${r.error}` : String(r.fullText?.length ?? 0).padStart(6);
    const img = r.imageUrl ? '✅' : '❌';
    const lebar = r.imageWidth ? String(r.imageWidth).padStart(5) : '    ?';
    console.log(`  ${host.padEnd(28)} ${teks}  ${img}     ${lebar}  ${r.attempt}`);
    if (r.warnings.length) console.log(`      ⚠️  ${r.warnings.join(', ')}`);
  }

  const ok = res.filter((r) => r.fullText && r.fullText.length >= 1500).length;
  console.log(`\n  Teks layak (>=1500) : ${ok}/${res.length}`);
  console.log(`  Ada gambar          : ${res.filter((r) => r.imageUrl).length}/${res.length}`);
  console.log(`  Butuh retry         : ${res.filter((r) => r.attempt === 'tanpa-referer').length}`);
  console.log(`  Gagal total         : ${res.filter((r) => r.error).length}`);
  console.log(`  Waktu               : ${((Date.now() - t0) / 1000).toFixed(1)} detik`);

  console.assert(res.every((r) => r.attempt !== undefined), 'extractMany tidak boleh melempar');
  const contoh = res.find((r) => r.fullText);
  if (contoh) console.log(`\n  Contoh teks: ${contoh.fullText!.slice(0, 160)}…`);
})();
