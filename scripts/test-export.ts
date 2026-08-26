/**
 * Uji nyata /api/export — generate PDF lalu BONGKAR ISI PDF-nya.
 * Butuh `npm run dev` jalan. Jalankan: npx --yes tsx scripts/test-export.ts
 */
import { writeFileSync, statSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Sandi dibaca dari .env.local, bukan dioper lewat shell — supaya tidak
// pernah muncul di riwayat perintah atau keluaran terminal.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const ALAMAT = 'http://localhost:3000/api/export';
const KELUAR = process.env.PDF_OUT || 'scripts/.uji-newsletter.pdf';
const PUBLISH = '2026-06-26';
// Periode berita (bukan tanggal terbit) — 1-31 Juli penuh, harus jadi "Edisi Juli 2026".
const PERIODE = { dari: '2026-07-01', sampai: '2026-07-31' };

const ARTIKEL = [
  {
    id: 'a1',
    title: 'Exciting Banten Festival 2026 Hadir di Anyer, Dorong Pariwisata dan Ekonomi Kreatif Daerah',
    summary:
      'Exciting Banten Festival 2026, yang diselenggarakan Dinas Pariwisata Provinsi Banten, akan berlangsung 27-28 Juni 2026. Bertempat di kawasan Pantai Cibeureum 1, Anyer, Kabupaten Serang, festival bertajuk "Ayo Ke Banten" ini bertujuan meningkatkan kunjungan wisatawan serta memperkuat ekonomi kreatif dan UMKM daerah.\n\nSekretaris Dinas Pariwisata Provinsi Banten, Dr. Hj. Nurhayati Nufus, menjelaskan festival ini dirancang sebagai promosi wisata sekaligus pusat pelayanan publik bagi masyarakat.',
    url: 'https://ketik.com/serang/politik-pemerintahan/exciting-banten-festival-2026-hadir-di-anyer',
    sourceName: 'ketik.com',
    // Sengaja TANPA gambar dan ditaruh paling depan: ini kasus yang diminta —
    // artikel pertama lebar penuh, lalu gambar artikel berikutnya harus jatuh
    // di KIRI (giliran pertama), bukan kanan.
    imageUrl: null,
  },
  {
    id: 'a2',
    title: 'Nikmati Keindahan Pantai Anyer dari Mövenpick Resort Carita',
    summary:
      'Mövenpick Resort Carita kini hadir sebagai daya tarik baru bagi pariwisata Anyer-Carita, Banten. Resor ini menawarkan 219 kamar dengan lima tipe berbeda, mulai dari Deluxe Terrace hingga Penthouse.\n\nSetiap kamar dilengkapi balkon langsung menghadap laut, memungkinkan tamu menikmati pemandangan matahari terbenam.',
    url: 'https://travel.detik.com/travel-news/d-8552848/nikmati-keindahan-pantai-anyer',
    sourceName: 'detikTravel',
    imageUrl: 'https://picsum.photos/seed/carita/800/600',
  },
  {
    id: 'a3',
    title: 'Mendes PDT Siapkan Bantuan Pengembangan Desa Wisata di Banten',
    summary:
      'Mendes PDT Yandri Susanto akan menyiapkan bantuan afirmasi pengembangan objek desa wisata terintegrasi dengan kawasan pantai di Provinsi Banten.\n\nProgram tersebut menargetkan desa-desa di kawasan Anyer, Cinangka, Padarincang, Mancak, Ciomas, dan Pandeglang.',
    url: 'https://mediabanten.com/mendes-pdt-siapkan-bantuan-pengembangan-desa-wisata-di-banten/',
    sourceName: 'MediaBanten.Com',
    imageUrl: null,
  },
  {
    // JALUR PENYELAMATAN MANUAL. Portal ini membalas 403 ke bot, jadi extract
    // selalu gagal: tidak ada fullText, tidak ada gambar, ringkasannya diketik
    // staf sendiri. Dulu artikel begini tidak pernah bisa masuk PDF karena
    // validasi memeriksa TAHAP proses, bukan isi. Jangan hapus fixture ini.
    id: 'a4',
    title: 'BMPP Siap Kolaborasi dengan Pemkab Serang, Festival Anyer Panarukan Jadi Langkah Awal',
    summary:
      'Badan Musyawarah Perhimpunan Pariwisata menyatakan kesiapannya berkolaborasi dengan Pemerintah Kabupaten Serang untuk mengembangkan sektor pariwisata daerah. Festival Anyer Panarukan disebut menjadi langkah awal dari kerja sama tersebut.\n\nKegiatan itu diharapkan menarik kunjungan wisatawan sekaligus menghidupkan usaha kecil di sekitar kawasan pantai.',
    url: 'https://kabarbanten.pikiran-rakyat.com/seputar-banten/pr-5910345075/bmpp-siap-kolaborasi',
    sourceName: 'Kabar Banten',
    imageUrl: null,
  },
];

/** <0041> → "A" */
const hexKeTeks = (h: string) =>
  (h.match(/.{1,4}/g) ?? []).map((x) => String.fromCharCode(parseInt(x.padEnd(4, '0'), 16))).join('');

/**
 * Chromium men-subset font, jadi teks di PDF tersimpan sebagai indeks glyph.
 * Peta indeks → huruf asli ada di stream /ToUnicode di dalam PDF itu sendiri.
 */
function bacaCMap(cmap: string, peta: Map<string, string>) {
  for (const blok of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of blok[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      peta.set(p[1].toLowerCase(), hexKeTeks(p[2]));
    }
  }
  for (const blok of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of blok[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      const d = parseInt(p[3], 16);
      for (let i = 0; i <= hi - lo && i < 65536; i++) {
        peta.set((lo + i).toString(16).padStart(p[1].length, '0'), String.fromCharCode(d + i));
      }
    }
    for (const p of blok[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(p[1], 16);
      [...p[3].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((it, i) =>
        peta.set((lo + i).toString(16).padStart(p[1].length, '0'), hexKeTeks(it[1])));
    }
  }
}

function isiPdf(buf: Buffer) {
  const s = buf.toString('latin1');

  // 1. inflate semua stream — zlib bawaan Node, tanpa library PDF
  const streams: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const mulai = m.index + m[0].length;
    const habis = s.indexOf('endstream', mulai);
    if (habis < 0) continue;
    try {
      streams.push(inflateSync(Buffer.from(s.slice(mulai, habis), 'latin1')).toString('latin1'));
    } catch {
      /* stream gambar, bukan teks */
    }
  }

  // 2. bangun peta glyph
  const peta = new Map<string, string>();
  for (const st of streams) if (/beginbf(char|range)/.test(st)) bacaCMap(st, peta);

  // 3. terjemahkan isi halaman
  let teks = '';
  for (const st of streams) {
    if (!/TJ|Tj/.test(st)) continue;
    for (const t of st.matchAll(/<([0-9A-Fa-f]+)>/g)) {
      for (const k of t[1].toLowerCase().match(/.{1,4}/g) ?? []) {
        teks += peta.get(k.padEnd(4, '0')) ?? '';
      }
    }
  }

  return {
    teks,
    glyph: peta.size,
    // Link diletakkan Chromium sebagai anotasi /URI — polos, tidak terkompresi.
    uri: [...s.matchAll(/\/URI\s*\((https?:[^)]+)\)/g)].map((x) => x[1]),
    halaman: (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
    gambar: (s.match(/\/Subtype\s*\/Image/g) ?? []).length,
    adaUrlGambarLuar: /\/(Alternate|URL)\s*\(https?:[^)]+\.(jpg|png|webp)/i.test(s),
  };
}

const DARI_BERKAS = process.env.ARTIKEL_JSON;

(async () => {
  if (DARI_BERKAS) {
    const { readFileSync } = await import('node:fs');
    ARTIKEL.length = 0;
    ARTIKEL.push(...JSON.parse(readFileSync(DARI_BERKAS, 'utf8')));
    console.log(`  (memakai ${ARTIKEL.length} artikel nyata dari ${DARI_BERKAS})
`);
  }
  // Aplikasi dijaga sandi (proxy.ts) — ambil cookie dulu supaya tidak kena 401.
  let cookie = '';
  if (process.env.APP_PASSWORD) {
    const masuk = await fetch(ALAMAT.replace('/export', '/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.APP_PASSWORD }),
    });
    cookie = (masuk.headers.get('set-cookie') ?? '').split(';')[0];
    console.log(`  (masuk: HTTP ${masuk.status})`);
  }

  const t0 = Date.now();
  const res = await fetch(ALAMAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ publishDate: PUBLISH, articles: ARTIKEL, periode: PERIODE }),
  });
  if (!res.ok) {
    console.log('  ❌ ' + JSON.stringify(await res.json().catch(() => ({}))));
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const detik = (Date.now() - t0) / 1000;
  writeFileSync(KELUAR, buf);

  const p = isiPdf(buf);
  const kb = statSync(KELUAR).size / 1024;
  const rapat = p.teks.replace(/\s+/g, ' ');

  console.log('  ── BERKAS ──');
  console.log(`  Waktu generate  : ${detik.toFixed(1)} detik`);
  console.log(`  Ukuran          : ${kb.toFixed(0)} KB ${kb > 60 ? '✅ gambar ikut ter-embed' : '🔴 terlalu kecil, kemungkinan teks saja'}`);
  console.log(`  Halaman         : ${p.halaman}`);
  console.log(`  Objek gambar    : ${p.gambar}`);
  console.log(`  Huruf terbaca   : ${p.teks.length} (dari ${p.glyph} glyph terpetakan)`);
  console.log(`  Nama unduhan    : ${res.headers.get('content-disposition')}`);

  console.log('\n  ── URL SUMBER DI DALAM PDF ──');
  for (const a of ARTIKEL) {
    console.log(`  ${p.uri.includes(a.url) ? '✅' : '🔴'} ${a.url.slice(0, 62)}`);
  }
  console.log(`  Total tautan di PDF: ${p.uri.length}`);

  console.log('\n  ── TANGGAL ──');
  const inggris = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.exec(rapat);
  console.log(`  ${rapat.includes('Terbit: Jumat, 26 Juni 2026') ? '✅' : '🔴'} Tanggal terbit "Terbit: Jumat, 26 Juni 2026"`);
  console.log(`  ${rapat.includes('Edisi Juli 2026') ? '✅' : '🔴'} Periode berita "Edisi Juli 2026" (1-31 Juli disingkat)`);
  console.log(`  ${inggris ? `🔴 ADA NAMA HARI/BULAN INGGRIS: ${inggris[0]}` : '✅ Tidak ada nama hari/bulan Inggris'}`);

  console.log('\n  ── ISI ──');
  const cek: [string, boolean][] = [
    ['Judul "Sanghyang Highlights"', rapat.includes('Sanghyang Highlights')],
    ['Merek "Sanghyang news"', rapat.includes('Sanghyang news')],
    ['Merek lama "Sanghyangresort" sudah hilang', !rapat.includes('Sanghyangresort')],
    // Dicek tanpa peduli besar-kecil huruf: gayanya text-transform: uppercase,
    // jadi di PDF terbaca "BERITA 1" walau di HTML tertulis "Berita 1".
    ['Nomor "Berita 1"', /berita 1/i.test(rapat)],
    ['Nomor "Berita 4"', /berita 4/i.test(rapat)],
    ['Tidak ada "Berita 5" (cuma 4 artikel)', !/berita 5/i.test(rapat)],
    // Artikel jalur manual: gagal extract, tanpa fullText, tanpa gambar.
    ['Artikel jalur manual ikut ke PDF', rapat.includes('Badan Musyawarah Perhimpunan Pariwisata')],
    ['Judul artikel jalur manual', rapat.includes('BMPP Siap Kolaborasi dengan Pemkab Serang')],
    ['Link sumber artikel jalur manual', rapat.includes('kabarbanten.pikiran-rakyat.com')],
    // Artikel tanpa gambar: slotnya dibuang, bukan diisi kotak abu-abu.
    ['Tidak ada kotak "tanpa gambar"', !/tanpa gambar/i.test(rapat)],
    ['Cuma 1 objek gambar (3 dari 4 artikel tanpa gambar)', p.gambar === 1],
    ['Footer www.sanghyang.com', rapat.includes('www.sanghyang.com')],
    ['Ejaan "Mövenpick" (umlaut) utuh', rapat.includes('Mövenpick')],
    ['Judul artikel 1', rapat.includes('Exciting Banten Festival 2026 Hadir di Anyer')],
    ['Judul artikel 3', rapat.includes('Mendes PDT Siapkan Bantuan')],
    ['Tidak ada URL gambar eksternal', !p.adaUrlGambarLuar],
  ];
  for (const [nama, ok] of cek) console.log(`  ${ok ? '✅' : '🔴'} ${nama}`);

  console.log(`\n  → ${KELUAR}`);
  console.log(`  Cuplikan teks PDF: "${rapat.slice(0, 130)}…"`);
})();
