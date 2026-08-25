/**
 * SPIKE v5 — Perbaikan Query & Skoring  [SPIKE TERAKHIR]
 *
 * Perbaikan dari v4:
 *   1. Lokasi besar (Serang/Cilegon/Banten) di-query BERSAMA topik
 *      → hindari batas 100 artikel kepakai berita generik
 *   2. Skoring berbasis TEMA, bukan berbasis ada-tidaknya pejabat
 *   3. Birokrasi internal (raperda/APBD/mutasi/BPK) diturunkan tajam
 *
 * Cara jalanin:
 *   node spike5.mjs
 *
 * Butuh Node 18+. Tidak butuh npm install.
 */

// ---------- KONFIGURASI QUERY ----------
// Lokasi kecil: query sendiri (semua beritanya memang lokal)
const LOC_KECIL = ['Anyer', 'Carita', 'Cinangka', 'Cikoneng'];

// Lokasi besar: WAJIB dipasangkan topik, kalau tidak hasilnya generik
const LOC_BESAR = ['Serang', 'Cilegon', 'Banten'];
const TOPIK_QUERY = ['wisata', 'hotel resort', 'investasi', 'pariwisata', 'festival'];

const AFTER = '2026-06-01';
const BEFORE = '2026-07-01';

const LOC_KEYS = ['anyer', 'carita', 'cinangka', 'cikoneng', 'serang', 'cilegon', 'banten'];

// ---------- BOBOT SKOR ----------
const W_WISATA = {
  score: 5,
  words: ['wisata', 'pariwisata', 'wisatawan', 'destinasi', 'resort', 'hotel',
    'penginapan', 'homestay', 'kuliner', 'pantai', 'desa wisata', 'okupansi'],
};
const W_EKONOMI = {
  score: 3,
  words: ['investasi', 'psn', 'proyek strategis', 'infrastruktur', 'tol',
    'pelabuhan', 'bandara', 'pembangunan', 'ekonomi', 'industri', 'pabrik',
    'lapangan kerja', 'umkm'],
};
const W_ACARA = {
  score: 3,
  words: ['festival', 'event', 'pameran', 'expo', 'pesta laut', 'karnaval', 'gelaran'],
};
const W_PEJABAT = {
  score: 2,
  words: ['gubernur', 'menteri', 'mendes', 'bupati', 'walikota', 'wali kota',
    'peresmian', 'resmikan', 'soft opening', 'kerja sama', 'groundbreaking'],
};

// Birokrasi internal — tidak layak newsletter hotel
const W_BIROKRASI = {
  score: -6,
  words: ['raperda', 'apbd', 'pertanggungjawaban', 'mutasi', 'sekwan', 'bpk',
    'monev', 'paripurna', 'banggar', 'lhp', 'interpelasi', 'beasiswa',
    'silpa', 'lkpj', 'reses', 'pansus', 'audit', 'honorer', 'asn', 'p3k'],
};

const LISTICLE = [
  'tak perlu', 'gak perlu', 'nggak perlu', 'rasa bali', 'hidden gem',
  'estetik', 'ramah kantong', 'murah meriah', 'anti mainstream',
  'weekend escape', 'wajib dikunjungi', 'wajib coba', 'rekomendasi',
  'ini dia', 'dijamin', 'bikin betah', 'cocok untuk', 'saingi',
  'butuh ', 'cari ', 'viral', 'ternyata', 'instagramable', 'instagenic',
  'spot foto', 'berburu senja', 'oase', 'bosan ',
];

const BLACKLIST = [
  'sepak bola', 'liga', 'persita', 'artis', 'gosip',
  'tewas', 'meninggal', 'tenggelam', 'terseret', 'korban', 'jenazah',
  'hilang', 'kebakaran', 'banjir', 'longsor', 'gempa',
  'begal', 'narkoba', 'pencurian', 'penipuan', 'curanmor', 'razia',
  'ditangkap', 'tersangka', 'korupsi', 'penganiayaan',
  'pilkada', 'pemilu', 'kampanye', 'partai',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const log = (...a) => console.log(...a);
const line = () => log('─'.repeat(66));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function timeout(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

// ---------- RSS ----------
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
      title: pick('title'), link: pick('link'), pubDate: pick('pubDate'),
      desc: pick('description'), sourceName: pick('source'),
    };
  });
}

async function fetchQuery(q) {
  const enc = encodeURIComponent(`${q} after:${AFTER} before:${BEFORE}`);
  const url = `https://news.google.com/rss/search?q=${enc}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseRss(await res.text()).map((it) => ({ ...it, query: q }));
}

async function fetchAll() {
  log('\n[1] AMBIL BERITA');
  line();
  const queries = [
    ...LOC_KECIL,
    ...LOC_BESAR.flatMap((l) => TOPIK_QUERY.map((t) => `${l} ${t}`)),
  ];
  log(`  Total query: ${queries.length}\n`);

  let all = [];
  let capped = 0;
  for (const q of queries) {
    process.stdout.write(`  ${q.padEnd(22)} `);
    try {
      const items = await fetchQuery(q);
      const cap = items.length >= 100;
      if (cap) capped++;
      log(`${String(items.length).padStart(3)}${cap ? ' ⚠️ mentok' : ''}`);
      all = all.concat(items);
    } catch (e) {
      log(`❌ ${e.message}`);
    }
    await sleep(200);
  }
  log(`\n  TOTAL MENTAH : ${all.length}`);
  log(`  Query mentok : ${capped}/${queries.length} ${capped === 0 ? '🟢' : '🟡'}`);
  return all;
}

// ---------- DEDUPE ----------
function idOf(link) {
  return link.split('/').pop().split('?')[0].slice(0, 60);
}

function crossDedupe(items) {
  log('\n\n[2] BUANG DOBEL ANTAR QUERY');
  line();
  const seen = new Map();
  for (const it of items) {
    const k = idOf(it.link);
    if (seen.has(k)) seen.get(k).hits++;
    else seen.set(k, { ...it, hits: 1 });
  }
  const uniq = [...seen.values()];
  log(`  Mentah : ${items.length}`);
  log(`  Unik   : ${uniq.length}`);
  log(`  Dobel  : ${items.length - uniq.length} (${Math.round((1 - uniq.length / items.length) * 100)}%)`);
  return uniq;
}

// ---------- FILTER ----------
function filterItems(items) {
  log('\n\n[3] FILTER');
  line();
  const drop = { bl: 0, loc: 0 };
  const kept = [];
  for (const it of items) {
    const title = norm(it.title);
    const hay = norm(it.title + ' ' + it.desc);
    if (BLACKLIST.some((b) => hay.includes(b))) { drop.bl++; continue; }
    const loc = LOC_KEYS.find((l) => title.includes(l));
    if (!loc) { drop.loc++; continue; }
    kept.push({ ...it, location: loc });
  }
  log(`  ➖ Blacklist           : ${drop.bl}`);
  log(`  ➖ Lokasi tak di judul : ${drop.loc}`);
  log(`  ✅ LOLOS               : ${kept.length}`);
  return kept;
}

// ---------- SKORING ----------
function hit(hay, group) {
  return group.words.filter((w) => hay.includes(w));
}

function scoreItem(it) {
  const title = norm(it.title);
  const hay = norm(it.title + ' ' + it.desc);
  let s = 0;
  const why = [];

  const w = hit(hay, W_WISATA);
  if (w.length) { s += W_WISATA.score * Math.min(w.length, 2); why.push(`🏖${w[0]}`); }

  const e = hit(hay, W_EKONOMI);
  if (e.length) { s += W_EKONOMI.score * Math.min(e.length, 2); why.push(`💰${e[0]}`); }

  const a = hit(hay, W_ACARA);
  if (a.length) { s += W_ACARA.score; why.push(`🎪${a[0]}`); }

  const p = hit(hay, W_PEJABAT);
  if (p.length) { s += W_PEJABAT.score; why.push(`🏛${p[0]}`); }

  const b = hit(hay, W_BIROKRASI);
  if (b.length) { s += W_BIROKRASI.score; why.push(`📋${b[0]}`); }

  const l = LISTICLE.filter((x) => title.includes(x));
  if (l.length) { s -= 4 * l.length; why.push(`📰${l[0]}`); }

  if (/^\d+\s/.test(it.title.trim())) { s -= 5; why.push('🔢'); }
  if (/[!?]/.test(it.title)) { s -= 3; why.push('❗'); }
  if (it.hits > 1) { s += 2; why.push(`✳️${it.hits}x`); }

  return { ...it, score: s, why };
}

function rank(items) {
  log('\n\n[4] PERINGKAT');
  line();
  const sc = items.map(scoreItem).sort((a, b) => b.score - a.score);
  const tinggi = sc.filter((x) => x.score >= 8);
  const sedang = sc.filter((x) => x.score >= 3 && x.score < 8);
  const rendah = sc.filter((x) => x.score < 3);

  log(`  🟢 Tinggi (>=8) : ${tinggi.length}  ← tampil default`);
  log(`  🟡 Sedang (3-7) : ${sedang.length}  ← tampil di bawah`);
  log(`  ⚪ Rendah (<3)  : ${rendah.length}  ← sembunyikan, buka via "Tampilkan semua"`);

  log('\n  ── 20 TERATAS ──');
  sc.slice(0, 20).forEach((it, i) => {
    log(`  ${String(i + 1).padStart(2)}. [${String(it.score).padStart(3)}] ${it.title.slice(0, 44)}`);
    log(`      ${it.sourceName.slice(0, 22).padEnd(22)} 📍${it.location} ${it.why.join(' ')}`);
  });

  log('\n  ── 6 TERBAWAH ──');
  sc.slice(-6).forEach((it) => {
    log(`      [${String(it.score).padStart(3)}] ${it.title.slice(0, 48)}`);
    log(`            ${it.why.join(' ')}`);
  });

  return sc;
}

// ---------- KESIMPULAN ----------
function verdict(raw, uniq, kept, sc) {
  log('\n\n[5] KESIMPULAN');
  line();
  const t = sc.filter((x) => x.score >= 8).length;
  const s = sc.filter((x) => x.score >= 3 && x.score < 8).length;
  log(`  Mentah         : ${raw}`);
  log(`  Unik           : ${uniq}`);
  log(`  Lolos filter   : ${kept}`);
  log('');
  log(`  Tampil default : ${t + s} kartu (tinggi + sedang)`);
  if (t + s > 45) log('  🔴 Masih terlalu banyak');
  else if (t + s > 25) log('  🟡 Agak banyak tapi masih bisa di-scan');
  else log('  🟢 Nyaman untuk di-review');
  log('');
  log(`  Perbandingan v4 → v5: 90 → ${kept} lolos filter`);
}

// ---------- MAIN ----------
(async () => {
  log('\n╔════════════════════════════════════════════════════════════════╗');
  log('║  SPIKE v5 — query lokasi+topik & skoring berbasis tema         ║');
  log('╚════════════════════════════════════════════════════════════════╝');
  log(`  Rentang: ${AFTER} s/d ${BEFORE}`);

  try {
    const raw = await fetchAll();
    const uniq = crossDedupe(raw);
    const kept = filterItems(uniq);
    const sc = rank(kept);
    verdict(raw.length, uniq.length, kept.length, sc);
  } catch (e) {
    log('\n❌ FATAL: ' + e.message);
  }

  log('\n');
  line();
  log('Selesai. Copy seluruh output dan paste ke chat.');
  line();
  log('');
})();
