/**
 * SPIKE v3 — Sanghyang News Scraper
 *
 * Perubahan dari v2:
 *   1. Lokasi WAJIB ada di judul (buang false positive geografis)
 *   2. Blacklist diperluas: musibah, kriminal, politik praktis
 *   3. Duplikat TIDAK dibuang — hanya ditandai
 *   4. Header lengkap untuk atasi HTTP 403
 *   5. Laporan per-aturan: apa yang dibuang oleh aturan mana
 *
 * Cara jalanin:
 *   node spike3.mjs
 *
 * Butuh Node 18+. Tidak butuh npm install.
 */

// ---------- KONFIGURASI ----------
const QUERY = 'Anyer';
const AFTER = '2026-06-01';
const BEFORE = '2026-07-01';
const MAX_RESOLVE = 10;

const LOCATIONS = ['anyer', 'carita', 'cinangka', 'cikoneng', 'serang', 'cilegon', 'banten'];

const TOPICS = [
  'wisata', 'pariwisata', 'wisatawan', 'destinasi', 'pantai', 'hotel',
  'resort', 'penginapan', 'investasi', 'ekonomi', 'infrastruktur', 'tol',
  'pelabuhan', 'proyek', 'pembangunan', 'psn', 'festival', 'event',
  'kuliner', 'gubernur', 'pemkot', 'pemprov', 'bupati', 'walikota', 'perda',
];

const BLACKLIST = [
  // olahraga & hiburan
  'sepak bola', 'liga', 'persita', 'artis', 'gosip',
  // musibah
  'tewas', 'meninggal', 'tenggelam', 'terseret', 'korban', 'jenazah',
  'hilang', 'kebakaran', 'banjir', 'longsor', 'gempa',
  // kriminal
  'begal', 'narkoba', 'pencurian', 'penipuan', 'curanmor', 'razia',
  'ditangkap', 'tersangka', 'korupsi', 'penganiayaan',
  // politik praktis
  'pilkada', 'pemilu', 'kampanye', 'partai',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Header lengkap — untuk portal yang menolak request polos
const FULL_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://www.google.com/',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'no-cache',
};

const log = (...a) => console.log(...a);
const line = () => log('─'.repeat(62));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function timeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

const norm = (s) => s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ---------- TAHAP 1: RSS ----------
function parseRss(xml) {
  return xml.split('<item>').slice(1).map((b) => {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      if (!m) return '';
      return m[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .trim();
    };
    const src = b.match(/<source url="([^"]+)"/);
    return {
      title: pick('title'),
      link: pick('link'),
      pubDate: pick('pubDate'),
      desc: pick('description'),
      sourceUrl: src ? src[1] : '',
      sourceName: pick('source'),
    };
  });
}

async function fetchRss() {
  log('\n[1] AMBIL BERITA DARI RSS');
  line();
  const q = encodeURIComponent(`${QUERY} after:${AFTER} before:${BEFORE}`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: timeout(15000) });
  const items = parseRss(await res.text());
  log(`✅ ${items.length} artikel mentah`);
  return items;
}

// ---------- TAHAP 2: FILTER BERTINGKAT ----------
function similarity(a, b) {
  const wa = new Set(a.split(' ').filter((w) => w.length > 3));
  const wb = new Set(b.split(' ').filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit++;
  return hit / Math.min(wa.size, wb.size);
}

function filterItems(items) {
  log('\n\n[2] FILTER BERTINGKAT');
  line();

  const dropped = { blacklist: [], location: [], topic: [] };
  let kept = [];

  for (const it of items) {
    const title = norm(it.title);
    const hay = norm(it.title + ' ' + it.desc);

    // Aturan 1: blacklist
    const bl = BLACKLIST.find((b) => hay.includes(b));
    if (bl) { dropped.blacklist.push([it.title, bl]); continue; }

    // Aturan 2: lokasi WAJIB di judul
    const loc = LOCATIONS.find((l) => title.includes(l));
    if (!loc) { dropped.location.push([it.title, '-']); continue; }

    // Aturan 3: topik
    const hits = TOPICS.filter((t) => hay.includes(t));
    if (hits.length === 0) { dropped.topic.push([it.title, '-']); continue; }

    kept.push({ ...it, location: loc, topics: hits.slice(0, 3), dupeOf: null });
  }

  // Aturan 4: tandai duplikat (TIDAK dibuang)
  let dupeCount = 0;
  for (let i = 0; i < kept.length; i++) {
    for (let j = 0; j < i; j++) {
      if (kept[j].dupeOf) continue;
      if (similarity(norm(kept[i].title), norm(kept[j].title)) > 0.55) {
        kept[i].dupeOf = j + 1;
        dupeCount++;
        break;
      }
    }
  }

  log(`  Mentah                  : ${items.length}`);
  log(`  ➖ Blacklist            : ${dropped.blacklist.length}`);
  log(`  ➖ Lokasi tak di judul  : ${dropped.location.length}`);
  log(`  ➖ Tanpa topik relevan  : ${dropped.topic.length}`);
  log(`  ✅ LOLOS                : ${kept.length}  (${dupeCount} ditandai duplikat)`);
  log(`  📉 Rasio buang          : ${Math.round((1 - kept.length / items.length) * 100)}%`);

  if (dropped.blacklist.length) {
    log('\n  Contoh dibuang blacklist:');
    dropped.blacklist.slice(0, 4).forEach(([t, w]) =>
      log(`    · [${w}] ${t.slice(0, 46)}`));
  }
  if (dropped.location.length) {
    log('\n  Contoh dibuang (lokasi tak di judul):');
    dropped.location.slice(0, 4).forEach(([t]) => log(`    · ${t.slice(0, 52)}`));
  }

  log('\n  ── LOLOS FILTER ──');
  kept.forEach((it, i) => {
    const flag = it.dupeOf ? ` ⚠️ mirip #${it.dupeOf}` : '';
    log(`  ${String(i + 1).padStart(2)}. ${it.title.slice(0, 48)}${flag}`);
    log(`      ${it.sourceName} · 📍${it.location} · 🏷 ${it.topics.join(', ')}`);
  });

  return kept;
}

// ---------- TAHAP 3: RESOLVE ----------
async function resolveOne(gnUrl) {
  const page = await fetch(gnUrl, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9' },
    signal: timeout(12000),
  });
  const html = await page.text();
  const sg = html.match(/data-n-a-sg="([^"]+)"/);
  const ts = html.match(/data-n-a-ts="([^"]+)"/);
  if (!sg || !ts) throw new Error('signature tidak ada');

  const id = gnUrl.split('/').pop().split('?')[0];
  const payload = JSON.stringify([[[
    'Fbv4je',
    JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
        'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      id, Number(ts[1]), sg[1],
    ]),
    null, 'generic',
  ]]]);

  const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'f.req=' + encodeURIComponent(payload),
    signal: timeout(12000),
  });
  const m = (await res.text()).match(/https?:\/\/(?!.*google\.com)[^\s"'\\]+/);
  if (!m) throw new Error('link tidak ditemukan');
  return m[0];
}

async function resolveAll(items) {
  log('\n\n[3] RESOLVE URL');
  line();
  const sample = items.slice(0, MAX_RESOLVE);
  const out = [];
  const t0 = Date.now();

  for (const [i, it] of sample.entries()) {
    process.stdout.write(`  ${String(i + 1).padStart(2)}/${sample.length} `);
    try {
      const url = await resolveOne(it.link);
      log(`✅ ${new URL(url).hostname}`);
      out.push({ ...it, finalUrl: url });
    } catch (e) {
      log(`❌ ${e.message}`);
      out.push({ ...it, finalUrl: null });
    }
    await sleep(300);
  }

  const ok = out.filter((o) => o.finalUrl).length;
  log(`\n  Hasil: ${ok}/${sample.length} · ${((Date.now() - t0) / 1000).toFixed(1)} detik`);
  return out;
}

// ---------- TAHAP 4: SCRAPE (header lengkap + retry) ----------
async function scrapeOne(url) {
  // Percobaan 1: header lengkap
  let res = await fetch(url, { headers: FULL_HEADERS, signal: timeout(12000) });
  if (res.ok) return { res, attempt: 'header-lengkap' };

  // Percobaan 2: tanpa Referer (sebagian portal menolak referer eksternal)
  const h2 = { ...FULL_HEADERS };
  delete h2.Referer;
  delete h2['Sec-Fetch-Site'];
  res = await fetch(url, { headers: h2, signal: timeout(12000) });
  if (res.ok) return { res, attempt: 'tanpa-referer' };

  return { res, attempt: 'gagal' };
}

async function scrapeAll(items) {
  log('\n\n[4] SCRAPE PORTAL (header lengkap)');
  line();
  const targets = items.filter((i) => i.finalUrl);
  if (!targets.length) { log('  Dilewati'); return; }

  const report = [];
  for (const [i, it] of targets.entries()) {
    const host = new URL(it.finalUrl).hostname.replace('www.', '');
    process.stdout.write(`  ${String(i + 1).padStart(2)}. ${host.padEnd(24)} `);
    try {
      const { res, attempt } = await scrapeOne(it.finalUrl);
      if (!res.ok) {
        log(`❌ HTTP ${res.status}`);
        report.push([host, 'http-' + res.status]);
        continue;
      }
      const html = await res.text();
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      const ok = text.length > 1500;
      const tag = attempt === 'header-lengkap' ? '' : ` (${attempt})`;
      log(`${ok ? '✅' : '⚠️ '} teks:${String(text.length).padStart(6)} gambar:${og ? '✅' : '❌'}${tag}`);
      report.push([host, ok ? 'ok' : 'teks-tipis']);
    } catch (e) {
      log(`❌ ${e.name}`);
      report.push([host, 'error']);
    }
    await sleep(200);
  }

  log('\n  RINGKASAN:');
  const good = report.filter((r) => r[1] === 'ok').length;
  log(`  ✅ Siap pakai : ${good}/${report.length}`);
  const bad = report.filter((r) => r[1] !== 'ok');
  if (bad.length) {
    log('  ⚠️  Bermasalah (perlu input manual):');
    bad.forEach(([h, s]) => log(`     · ${h} (${s})`));
  }
}

// ---------- MAIN ----------
(async () => {
  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║  SPIKE v3 — filter ketat + perbaikan 403                 ║');
  log('╚══════════════════════════════════════════════════════════╝');

  try {
    const raw = await fetchRss();
    const filtered = filterItems(raw);
    const resolved = await resolveAll(filtered);
    await scrapeAll(resolved);
  } catch (e) {
    log('\n❌ FATAL: ' + e.message);
  }

  log('\n');
  line();
  log('Selesai. Copy seluruh output dan paste ke chat.');
  line();
  log('');
})();
