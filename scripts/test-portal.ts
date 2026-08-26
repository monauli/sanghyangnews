/**
 * Ukur seberapa besar masalah "portal tidak bisa dibaca otomatis".
 * Menguji SELURUH artikel grup tinggi + sedang dari dua rentang, bukan cuma teratas.
 *
 * TIDAK memanggil Gemini sama sekali — ini murni uji extract.
 *
 * Jalankan: npx --yes tsx scripts/test-portal.ts
 * Bandingkan dengan Vercel (opsional, butuh APP_PASSWORD di .env.local):
 *   VERCEL_APP_URL=https://namamu.vercel.app npx --yes tsx scripts/test-portal.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { searchAll } from '../lib/googlenews';
import { filterArticles } from '../lib/filter';
import { scoreArticles, tierOf } from '../lib/scoring';
import { resolveOne } from '../lib/resolver';
import { extractOne, FULL_HEADERS } from '../lib/extractor';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const RENTANG: [string, string][] = [
  ['2026-07-01', '2026-07-31'],
  ['2026-08-01', '2026-08-25'],
];
const MAKS_SAMPEL = 70;
/**
 * Daftar URL sampel disimpan supaya uji berikutnya (mis. perbandingan Vercel)
 * memakai daftar yang SAMA PERSIS — kalau dicari ulang, sampel acaknya berbeda
 * dan angkanya tidak bisa dibandingkan. Hapus berkasnya untuk ambil sampel baru.
 */
const BERKAS_SAMPEL = 'scripts/.portal-sampel.json';
const JEDA = 1200;        // jeda antar artikel, supaya tidak membebani portal
const MIN_TEXT = 1500;    // ambang yang sama dengan lib/extractor.ts
const BATAS_DIAG = 10000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- DIAGNOSIS ----------

/** Frasa khas halaman perlindungan bot. Dicari di badan respons. */
const TANDA_BOT = [
  'just a moment', 'attention required', 'checking your browser',
  'enable javascript and cookies', 'cf-browser-verification', 'cf_chl_opt',
  'access denied', 'ddos protection', 'datadome', 'perimeterx', '_incapsula_',
  'captcha', 'request blocked', 'akamai', 'you have been blocked',
];

/** Kerangka aplikasi kosong — penanda kuat isinya dipasang lewat JavaScript. */
const RX_KERANGKA = /<div[^>]*id=["'](root|app|__next|__nuxt|main-content|q-app)["'][^>]*>\s*<\/div>/i;

type Diagnosa = {
  status: number | null;
  server: string | null;
  cfRay: string | null;
  cfMitigated: string | null;
  panjangHtml: number;
  teksMentah: number;      // panjang teks setelah semua tag dibuang
  adaNoscript: boolean;
  kerangkaKosong: string | null;
  tandaBot: string | null;
  jumlahP: number;         // sedikit <p> + banyak <img> = galeri foto, bukan artikel
  jumlahImg: number;
  galat: string | null;
  kode: string | null;     // err.cause.code — "fetch failed" saja tidak memberi tahu apa pun
};

async function diagnosa(url: string): Promise<Diagnosa> {
  const kosong: Diagnosa = {
    status: null, server: null, cfRay: null, cfMitigated: null,
    panjangHtml: 0, teksMentah: 0, adaNoscript: false,
    kerangkaKosong: null, tandaBot: null, jumlahP: 0, jumlahImg: 0,
    galat: null, kode: null,
  };
  try {
    const res = await fetch(url, { headers: FULL_HEADERS, signal: AbortSignal.timeout(BATAS_DIAG) });
    const html = await res.text();
    const rendah = html.toLowerCase();
    const teks = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      status: res.status,
      server: res.headers.get('server'),
      cfRay: res.headers.get('cf-ray'),
      cfMitigated: res.headers.get('cf-mitigated'),
      panjangHtml: html.length,
      teksMentah: teks.length,
      adaNoscript: /<noscript[\s>]/i.test(html),
      kerangkaKosong: (html.match(RX_KERANGKA) ?? [])[1] ?? null,
      tandaBot: TANDA_BOT.find((t) => rendah.includes(t)) ?? null,
      jumlahP: (html.match(/<p[\s>]/gi) ?? []).length,
      jumlahImg: (html.match(/<img[\s>]/gi) ?? []).length,
      galat: null,
      kode: null,
    };
  } catch (e) {
    // "fetch failed" itu bungkus Node yang tidak memberi tahu apa pun. Sebab
    // aslinya ada di .cause — di situlah beda antara sertifikat rusak,
    // paket di-drop firewall, dan domain mati jadi kelihatan.
    const err = e as Error & { cause?: { message?: string; code?: string } };
    return {
      ...kosong,
      galat: err.cause?.message ? `${err.message} — ${err.cause.message}` : err.message,
      kode: err.cause?.code ?? null,
    };
  }
}

// ---------- KLASIFIKASI ----------

type Kategori =
  | 'DIBLOKIR' | 'DIPUTUS' | 'BUTUH-JS' | 'EXTRACTOR' | 'TANPA-TEKS'
  | 'TEKS-PENDEK' | 'SERTIFIKAT' | 'TIMEOUT' | 'TIDAK-ADA' | 'LAIN';

const NAMA: Record<Kategori, string> = {
  DIBLOKIR: '1a. DIBLOKIR SENGAJA (403 / tantangan bot)',
  DIPUTUS: '1b. KONEKSI DITELAN (paket TCP di-drop firewall)',
  'BUTUH-JS': '2a. BUTUH JAVASCRIPT (ada bukti kerangka kosong / noscript)',
  EXTRACTOR: '2b. HTML BERISI, EXTRACTOR TIDAK MENGENALI',
  'TANPA-TEKS': '2c. HALAMAN MEMANG TANPA TEKS ARTIKEL (galeri foto)',
  'TEKS-PENDEK': '2d. HALAMAN PENDEK, SEBAB BELUM PASTI',
  SERTIFIKAT: '3a. RANTAI SERTIFIKAT TLS TIDAK LENGKAP',
  TIMEOUT: '3b. TIMEOUT MENUNGGU JAWABAN (server menyambut, lalu lambat)',
  'TIDAK-ADA': '4. TIDAK ADA (404 / domain mati)',
  LAIN: '5. LAIN-LAIN',
};

/** Kategori yang, sejauh bukti yang ada, PERCUMA ditulis kodenya. */
const SIA_SIA: Kategori[] = ['DIBLOKIR', 'DIPUTUS', 'TANPA-TEKS', 'TIDAK-ADA'];
/** Kategori yang masuk akal diperbaiki tanpa browser headless. */
const LAYAK: Kategori[] = ['EXTRACTOR', 'SERTIFIKAT', 'TIMEOUT'];

const RX_SERTIFIKAT = /UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_HAS_EXPIRED|SELF_SIGNED|ERR_TLS|CERT_UNTRUSTED|ALTNAME/i;

function klasifikasi(galatExtract: string | undefined, d: Diagnosa): { kat: Kategori; bukti: string } {
  if (d.galat) {
    const jejak = `${d.kode ?? ''} ${d.galat}`;

    // Sertifikat rusak: servernya SEHAT, cuma rantai sertifikatnya kurang.
    // Terukur: berita.cilegon.go.id menjawab port 443 dalam 14 ms.
    if (RX_SERTIFIKAT.test(jejak)) {
      return { kat: 'SERTIFIKAT', bukti: `${d.kode ?? 'TLS'} — ${d.galat}` };
    }
    if (/ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED/i.test(jejak)) {
      return { kat: 'TIDAK-ADA', bukti: `domain tidak terselesaikan: ${d.galat}` };
    }
    // Gagal di tahap CONNECT = paket TCP ditelan, bukan server yang lambat.
    // Menaikkan batas waktu terbukti tidak menolong: 12/30/60 detik sama saja,
    // dan uji TCP langsung ke port 443 & 80 juga timeout, bukan ditolak.
    if (/UND_ERR_CONNECT_TIMEOUT|Connect Timeout|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/i.test(jejak)) {
      return { kat: 'DIPUTUS', bukti: `${d.kode ?? 'connect'} — ${d.galat}` };
    }
    if (/timeout|timed out|aborted|ETIMEDOUT/i.test(jejak)) {
      return { kat: 'TIMEOUT', bukti: `menunggu jawaban terlalu lama: ${d.galat}` };
    }
    return { kat: 'LAIN', bukti: `${d.kode ?? 'galat'} — ${d.galat}` };
  }

  if (d.status === 404 || d.status === 410) return { kat: 'TIDAK-ADA', bukti: `HTTP ${d.status}` };

  const jejakBlokir = [
    d.server ? `server=${d.server}` : null,
    d.cfRay ? `cf-ray=${d.cfRay}` : null,
    d.cfMitigated ? `cf-mitigated=${d.cfMitigated}` : null,
    d.tandaBot ? `badan memuat "${d.tandaBot}"` : null,
  ].filter(Boolean).join(', ');

  if (d.status !== null && [401, 403, 429, 451, 503].includes(d.status)) {
    return { kat: 'DIBLOKIR', bukti: `HTTP ${d.status}${jejakBlokir ? ' · ' + jejakBlokir : ''}` };
  }
  if (d.tandaBot || d.cfMitigated) {
    return { kat: 'DIBLOKIR', bukti: `HTTP ${d.status} tapi ${jejakBlokir}` };
  }

  if (d.status === 200) {
    // Banyak gambar, hampir tanpa paragraf = galeri foto. Tidak ada teks artikel
    // untuk diambil — bukan cacat extractor, dan tidak ada yang bisa diperbaiki.
    if (d.jumlahImg >= 15 && d.jumlahP <= 5) {
      return { kat: 'TANPA-TEKS', bukti: `HTTP 200, ${d.jumlahImg} <img> tapi cuma ${d.jumlahP} <p> — halaman galeri` };
    }
    // Teks mentah banyak tapi extractor cuma dapat sedikit = template tidak
    // dikenali, BUKAN masalah JavaScript.
    if (d.teksMentah >= 4000) {
      return { kat: 'EXTRACTOR', bukti: `HTTP 200, teks mentah ${d.teksMentah} huruf tapi extractor gagal` };
    }
    // BUTUH-JS hanya kalau ADA buktinya. Tanpa penanda, jangan mengaku tahu.
    const petunjuk = [
      d.kerangkaKosong ? `kerangka kosong <div id="${d.kerangkaKosong}">` : null,
      d.adaNoscript ? '<noscript> ada' : null,
    ].filter(Boolean);
    if (petunjuk.length) {
      return { kat: 'BUTUH-JS', bukti: `HTTP 200, teks mentah ${d.teksMentah} huruf · ${petunjuk.join(', ')}` };
    }
    return {
      kat: 'TEKS-PENDEK',
      bukti: `HTTP 200, teks mentah ${d.teksMentah} huruf, ${d.jumlahP} <p>/${d.jumlahImg} <img>`
        + ' · tanpa <noscript> maupun kerangka kosong — tidak ada bukti butuh JS',
    };
  }

  return { kat: 'LAIN', bukti: `HTTP ${d.status ?? '?'} · ${galatExtract ?? 'tanpa keterangan'}` };
}

// Cek cepat cabang klasifikasi tanpa jaringan:
//   UJI_KLASIFIKASI=1 npx --yes tsx scripts/test-portal.ts
if (process.env.UJI_KLASIFIKASI) {
  const d = (p: Partial<Diagnosa>): Diagnosa => ({
    status: 200, server: null, cfRay: null, cfMitigated: null, panjangHtml: 0,
    teksMentah: 0, adaNoscript: false, kerangkaKosong: null, tandaBot: null,
    jumlahP: 20, jumlahImg: 2, galat: null, kode: null, ...p,
  });
  const kasus: [string, Diagnosa, Kategori][] = [
    ['403 + cloudflare challenge', d({ status: 403, server: 'cloudflare', cfMitigated: 'challenge', tandaBot: 'just a moment' }), 'DIBLOKIR'],
    ['200 tapi badan halaman tantangan', d({ tandaBot: 'checking your browser' }), 'DIBLOKIR'],
    ['paket TCP ditelan', d({ galat: 'fetch failed — Connect Timeout Error', kode: 'UND_ERR_CONNECT_TIMEOUT' }), 'DIPUTUS'],
    ['sertifikat tidak lengkap', d({ galat: 'unable to verify the first certificate', kode: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }), 'SERTIFIKAT'],
    ['lambat menjawab', d({ galat: 'The operation was aborted due to timeout' }), 'TIMEOUT'],
    ['domain mati', d({ galat: 'getaddrinfo ENOTFOUND x.test', kode: 'ENOTFOUND' }), 'TIDAK-ADA'],
    ['404', d({ status: 404 }), 'TIDAK-ADA'],
    ['galeri foto', d({ teksMentah: 2600, jumlahP: 3, jumlahImg: 36 }), 'TANPA-TEKS'],
    ['html berisi, extractor gagal', d({ teksMentah: 10500 }), 'EXTRACTOR'],
    ['kerangka kosong', d({ teksMentah: 500, kerangkaKosong: 'root' }), 'BUTUH-JS'],
    ['noscript', d({ teksMentah: 500, adaNoscript: true }), 'BUTUH-JS'],
    ['pendek tanpa bukti apa pun', d({ teksMentah: 2750 }), 'TEKS-PENDEK'],
  ];
  let salah = 0;
  for (const [label, diag, harap] of kasus) {
    const k = klasifikasi(undefined, diag);
    const ok = k.kat === harap;
    if (!ok) salah++;
    console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label.padEnd(32)} → ${k.kat}${ok ? '' : ` (harap ${harap})`}`);
  }
  console.log(`\n  ${salah === 0 ? '✅ semua benar' : `🔴 ${salah} salah`}`);
  process.exit(salah === 0 ? 0 : 1);
}

// ---------- JALAN ----------

type Baris = {
  judul: string;
  sumber: string;
  domain: string;
  url: string | null;
  berhasil: boolean;
  panjangTeks: number;
  attempt: string;
  kat?: Kategori;
  bukti?: string;
};

const domainDari = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return '(tak terbaca)'; }
};

const persen = (n: number, dari: number) => dari === 0 ? '0%' : `${Math.round((n / dari) * 100)}%`;

type Sampel = { judul: string; sumber: string; url: string };

async function ambilSampel(): Promise<Sampel[]> {
  if (existsSync(BERKAS_SAMPEL)) {
    const lama: Sampel[] = JSON.parse(readFileSync(BERKAS_SAMPEL, 'utf8'));
    console.log(`  Memakai daftar tersimpan: ${lama.length} URL dari ${BERKAS_SAMPEL}`);
    console.log('  (hapus berkas itu kalau mau sampel acak baru)\n');
    return lama;
  }

  console.log('  Mengumpulkan artikel…\n');
  const kumpulan: { title: string; sourceName: string; link: string; id: string }[] = [];
  for (const [dari, sampai] of RENTANG) {
    const { articles: raw } = await searchAll(dari, sampai);
    const { articles } = filterArticles(raw);
    const sc = scoreArticles(articles).filter((a) => tierOf(a.score) !== 'rendah');
    console.log(`  ${dari} s/d ${sampai}: ${raw.length} mentah → ${sc.length} artikel tinggi+sedang`);
    kumpulan.push(...sc.map((a) => ({ title: a.title, sourceName: a.sourceName, link: a.link, id: a.id })));
  }

  const unik = [...new Map(kumpulan.map((a) => [a.id, a])).values()];
  let pilih = unik;
  if (unik.length > 100) {
    pilih = [...unik].sort(() => Math.random() - 0.5).slice(0, MAKS_SAMPEL);
    console.log(`\n  Kolam ${unik.length} artikel unik → diambil acak ${pilih.length} sebagai sampel.`);
  } else {
    console.log(`\n  ${unik.length} artikel unik, semuanya diuji (di bawah ambang 100).`);
  }

  // Resolve sekarang dan simpan URL akhirnya: yang dibandingkan harus URL portal
  // yang sama, bukan tautan Google News yang bisa mengarah ke tempat berbeda.
  console.log('  Menerjemahkan tautan Google News…');
  const out: Sampel[] = [];
  for (const a of pilih) {
    try {
      out.push({ judul: a.title, sumber: a.sourceName, url: await resolveOne(a.link) });
    } catch (e) {
      console.log(`    🔴 resolve gagal: ${(e as Error).message}`);
    }
    await sleep(300);
  }
  writeFileSync(BERKAS_SAMPEL, JSON.stringify(out, null, 2));
  console.log(`  ${out.length} URL tersimpan di ${BERKAS_SAMPEL}\n`);
  return out;
}

(async () => {
  const sampel = await ambilSampel();
  console.log(`  Jeda ${JEDA} ms antar artikel. TIDAK ada panggilan Gemini.\n`);

  const baris: Baris[] = [];
  const t0 = Date.now();

  for (const [i, a] of sampel.entries()) {
    const url = a.url;

    const ex = await extractOne(url);
    const panjang = ex.fullText?.length ?? 0;
    const berhasil = panjang >= MIN_TEXT;
    const b: Baris = {
      judul: a.judul, sumber: a.sumber, domain: domainDari(url), url,
      berhasil, panjangTeks: panjang, attempt: ex.attempt,
    };

    if (!berhasil) {
      const d = await diagnosa(url);
      const k = klasifikasi(ex.error, d);
      b.kat = k.kat;
      b.bukti = k.bukti;
    }
    baris.push(b);

    process.stdout.write(
      `  ${String(i + 1).padStart(3)}/${sampel.length} ${berhasil ? '✅' : '🔴'} ` +
      `${b.domain.padEnd(32).slice(0, 32)} ${berhasil ? `${panjang} huruf` : NAMA[b.kat!]}\n`,
    );
    await sleep(JEDA);
  }

  // ---------- A. RINGKASAN ----------
  const total = baris.length;
  const ok = baris.filter((b) => b.berhasil).length;
  const gagal = total - ok;
  const tipis = baris.filter((b) => !b.berhasil && b.panjangTeks > 0).length;

  console.log('\n' + '═'.repeat(78));
  console.log('  A. RINGKASAN');
  console.log('═'.repeat(78));
  console.log(`  Total artikel diuji : ${total}`);
  console.log(`  Berhasil            : ${ok} (${persen(ok, total)})   — teks >= ${MIN_TEXT} huruf`);
  console.log(`  Gagal               : ${gagal} (${persen(gagal, total)})`);
  console.log(`  Dari yang gagal, ${tipis} sebenarnya dapat teks tapi terlalu tipis (lolos di aplikasi, bahan kurang).`);
  console.log(`  Lama uji            : ${Math.round((Date.now() - t0) / 1000)} detik`);

  // ---------- B. PER PORTAL ----------
  console.log('\n' + '═'.repeat(78));
  console.log('  B. RINCIAN PER PORTAL (urut dari yang paling sering gagal)');
  console.log('═'.repeat(78));
  const perDomain = new Map<string, Baris[]>();
  for (const b of baris) {
    if (!perDomain.has(b.domain)) perDomain.set(b.domain, []);
    perDomain.get(b.domain)!.push(b);
  }
  const urut = [...perDomain.entries()].sort((x, y) => {
    const gx = x[1].filter((b) => !b.berhasil).length;
    const gy = y[1].filter((b) => !b.berhasil).length;
    return gy - gx || y[1].length - x[1].length;
  });
  console.log(`  ${'domain'.padEnd(34)} muncul  ok  gagal  penyebab`);
  console.log('  ' + '─'.repeat(74));
  for (const [dom, list] of urut) {
    const g = list.filter((b) => !b.berhasil);
    const sebab = [...new Set(g.map((b) => NAMA[b.kat!]))].join(', ') || '-';
    console.log(
      `  ${dom.padEnd(34).slice(0, 34)} ${String(list.length).padStart(4)}` +
      `${String(list.length - g.length).padStart(5)}${String(g.length).padStart(6)}  ${sebab}`,
    );
  }

  // ---------- C. KLASIFIKASI ----------
  console.log('\n' + '═'.repeat(78));
  console.log('  C. KLASIFIKASI PENYEBAB KEGAGALAN (dengan bukti)');
  console.log('═'.repeat(78));
  const urutKat: Kategori[] = ['DIBLOKIR', 'DIPUTUS', 'BUTUH-JS', 'EXTRACTOR',
    'TANPA-TEKS', 'TEKS-PENDEK', 'SERTIFIKAT', 'TIMEOUT', 'TIDAK-ADA', 'LAIN'];
  const hitung = new Map<Kategori, Baris[]>();
  for (const b of baris.filter((x) => !x.berhasil)) {
    if (!hitung.has(b.kat!)) hitung.set(b.kat!, []);
    hitung.get(b.kat!)!.push(b);
  }
  for (const k of urutKat) {
    const list = hitung.get(k) ?? [];
    console.log(`\n  ${NAMA[k]} — ${list.length} artikel (${persen(list.length, gagal)} dari kegagalan)`);
    for (const b of list) {
      console.log(`    ${b.domain}`);
      console.log(`      bukti: ${b.bukti}`);
    }
    if (!list.length) console.log('    (tidak ada)');
  }

  // ---------- D. KESIMPULAN ----------
  const n = (k: Kategori) => (hitung.get(k) ?? []).length;
  const jml = (ks: Kategori[]) => ks.reduce((s, k) => s + n(k), 0);
  const bisa = jml(LAYAK);
  const tidakBisa = jml(SIA_SIA);
  const butuhBrowser = n('BUTUH-JS');
  const belumPasti = n('TEKS-PENDEK') + n('LAIN');

  console.log('\n' + '═'.repeat(78));
  console.log('  D. KESIMPULAN');
  console.log('═'.repeat(78));
  console.log(`  Masuk akal diperbaiki  : ${bisa} dari ${gagal} kegagalan (${persen(bisa, gagal)})`);
  console.log(`    ${LAYAK.map((k) => `${NAMA[k].split('.')[0]}=${n(k)}`).join('  ')}`);
  console.log(`  Praktis TIDAK bisa     : ${tidakBisa} dari ${gagal} (${persen(tidakBisa, gagal)})`);
  console.log(`    ${SIA_SIA.map((k) => `${NAMA[k].split('.')[0]}=${n(k)}`).join('  ')}`);
  console.log(`  Butuh browser headless : ${butuhBrowser} (${persen(butuhBrowser, gagal)}) — mahal, dihitung terpisah`);
  console.log(`  Sebabnya belum pasti   : ${belumPasti} (${persen(belumPasti, gagal)})`);
  console.log(`\n  Terhadap SELURUH ${total} artikel yang diuji:`);
  console.log(`    ${persen(ok, total)} sudah berhasil sekarang`);
  console.log(`    ${persen(bisa, total)} berpotensi diselamatkan tanpa browser headless`);
  console.log(`    ${persen(tidakBisa, total)} memang tidak bisa`);

  // ---------- E. BANDINGKAN DENGAN VERCEL ----------
  const VERCEL = process.env.VERCEL_APP_URL;
  if (!VERCEL) {
    console.log('\n  (Perbandingan Vercel dilewati — set VERCEL_APP_URL untuk mengukur dari IP datacenter.)');
    return;
  }
  console.log('\n' + '═'.repeat(78));
  console.log('  E. LOKAL vs VERCEL (IP rumah vs IP datacenter)');
  console.log('═'.repeat(78));

  const masuk = await fetch(`${VERCEL}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.APP_PASSWORD }),
  });
  const cookie = (masuk.headers.get('set-cookie') ?? '').split(';')[0];
  console.log(`  (masuk: HTTP ${masuk.status})`);
  if (!masuk.ok) { console.log('  🔴 gagal masuk, perbandingan dilewati'); return; }

  const daftar = baris.filter((b) => b.url).map((b) => ({
    url: b.url!, domain: b.domain, lokalOk: b.berhasil, lokalKat: b.kat,
  }));
  type HasilV = { ok: boolean; panjang: number; galat: string; ms: number };
  const hasilVercel = new Map<string, HasilV>();

  // SATU url per permintaan, bukan blok. Alasannya: dengan satu url, lama
  // permintaan = lama satu extract, dan itu memisahkan sertifikat rusak
  // (gagal < 1 detik) dari paket TCP ditelan (gagal ~10 detik). Kalau digabung
  // 3-3, waktunya tercampur dan pertanyaan bantenprov tidak terjawab.
  for (const [i, b] of daftar.entries()) {
    const t = Date.now();
    let h: HasilV = { ok: false, panjang: 0, galat: '(tak terjawab)', ms: 0 };
    try {
      const r = await fetch(`${VERCEL}/api/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ urls: [b.url] }),
        signal: AbortSignal.timeout(70_000),
      });
      const j = await r.json();
      const hasil = j.results?.[0];
      const panjang = hasil?.fullText?.length ?? 0;
      h = {
        ok: panjang >= MIN_TEXT,
        panjang,
        galat: hasil?.error ?? (panjang > 0 ? `teks cuma ${panjang} huruf` : (j.error ?? 'teks kosong')),
        ms: Date.now() - t,
      };
    } catch (e) {
      h = { ok: false, panjang: 0, galat: `permintaan gagal: ${(e as Error).message}`, ms: Date.now() - t };
    }
    hasilVercel.set(b.url, h);
    console.log(
      `  ${String(i + 1).padStart(3)}/${daftar.length} ` +
      `lokal ${b.lokalOk ? '✅' : '🔴'} vercel ${h.ok ? '✅' : '🔴'} ` +
      `${String(h.ms).padStart(6)}ms  ${b.domain.padEnd(30).slice(0, 30)} ${h.ok ? '' : h.galat}`,
    );
    await sleep(800);
  }

  const V = (u: string) => hasilVercel.get(u)!;
  const okV = daftar.filter((b) => V(b.url).ok).length;
  const okL = daftar.filter((b) => b.lokalOk).length;

  console.log('\n  ── 4. KEBERHASILAN KESELURUHAN ──');
  console.log(`  Lokal  (IP rumah)     : ${okL}/${daftar.length} (${persen(okL, daftar.length)})`);
  console.log(`  Vercel (IP datacenter): ${okV}/${daftar.length} (${persen(okV, daftar.length)})`);

  console.log('\n  ── 1. TABEL PER DOMAIN ──');
  const dom = new Map<string, { n: number; l: number; v: number; sebabV: Set<string> }>();
  for (const b of daftar) {
    if (!dom.has(b.domain)) dom.set(b.domain, { n: 0, l: 0, v: 0, sebabV: new Set() });
    const d = dom.get(b.domain)!;
    d.n++;
    if (b.lokalOk) d.l++;
    if (V(b.url).ok) d.v++; else d.sebabV.add(V(b.url).galat.slice(0, 48));
  }
  const beda = (d: { n: number; l: number; v: number }) => d.l === d.v ? ' ' : d.v > d.l ? '↑' : '↓';
  console.log(`  ${'domain'.padEnd(32)}  n  lokal  vercel   penyebab di vercel`);
  console.log('  ' + '─'.repeat(90));
  for (const [nama, d] of [...dom.entries()].sort((a, b) => (a[1].v - a[1].l) - (b[1].v - b[1].l))) {
    console.log(
      `  ${nama.padEnd(32).slice(0, 32)} ${String(d.n).padStart(2)}` +
      `${String(d.l).padStart(6)}${String(d.v).padStart(7)} ${beda(d)} ${[...d.sebabV].join(' | ')}`,
    );
  }

  const turun = daftar.filter((b) => b.lokalOk && !V(b.url).ok);
  const naik = daftar.filter((b) => !b.lokalOk && V(b.url).ok);

  console.log(`\n  ── 2. LOLOS DI RUMAH, DITOLAK DI VERCEL: ${turun.length} ──`);
  if (!turun.length) console.log('    (tidak ada)');
  for (const b of turun) console.log(`    ${b.domain.padEnd(32)} ${V(b.url).ms}ms  ${V(b.url).galat}`);

  console.log(`\n  ── 3. DITOLAK DI RUMAH, LOLOS DI VERCEL: ${naik.length} ──`);
  if (!naik.length) console.log('    (tidak ada)');
  for (const b of naik) console.log(`    ${b.domain.padEnd(32)} lokal=${b.lokalKat}  vercel=${V(b.url).panjang} huruf`);

  console.log('\n  ── PERTANYAAN KHUSUS ──');
  for (const target of ['bantenprov.go.id', 'berita.cilegon.go.id']) {
    const l = daftar.filter((b) => b.domain === target);
    if (!l.length) { console.log(`  ${target}: tidak ada di sampel`); continue; }
    console.log(`  ${target}: lokal ${l.filter((b) => b.lokalOk).length}/${l.length}, ` +
      `vercel ${l.filter((b) => V(b.url).ok).length}/${l.length}`);
    for (const b of l) console.log(`    vercel ${V(b.url).ms}ms — ${V(b.url).galat}`);
  }
})();
