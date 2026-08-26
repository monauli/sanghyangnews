/** Uji penjaga SSRF. Jalankan: npx --yes tsx scripts/test-urlaman.ts */
import { urlAman, alamatAman, ipTerlarang, fetchAman, lookupBerbatas } from '../lib/urlaman';

let gagal = 0;
const cek = (ok: boolean, label: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}`);
};

(async () => {
  console.log('  ── NOMOR IP TERLARANG ──');
  for (const ip of [
    '127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.255',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '198.18.0.1', '224.0.0.1',
    '240.0.0.1', '192.0.0.1', '::1', '::', 'fc00::1', 'fd12::34', 'fe80::1',
    '::ffff:127.0.0.1',
  ]) cek(ipTerlarang(ip), ip);

  console.log('\n  ── NOMOR IP BOLEH ──');
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '11.0.0.1',
    '100.63.255.255', '2606:4700::1111']) cek(!ipTerlarang(ip), ip);

  console.log('\n  ── ALAMAT HARUS DITOLAK (termasuk yang lewat DNS) ──');
  for (const [u, ket] of [
    ['http://169.254.169.254/latest/meta-data/', 'metadata cloud'],
    ['http://localhost:3000/api/export', 'localhost'],
    ['http://127.0.0.1:8080/', 'loopback'],
    ['http://2130706433/', '127.0.0.1 desimal'],
    ['http://0x7f000001/', '127.0.0.1 heksadesimal'],
    ['http://0177.0.0.1/', '127.0.0.1 oktal'],
    ['http://localtest.me/', 'nama biasa → 127.0.0.1 (butuh DNS)'],
    ['http://127.0.0.1.nip.io/', 'nama biasa → 127.0.0.1 (butuh DNS)'],
    ['http://100.64.0.1/', 'CGNAT'],
    ['http://[::1]/', 'loopback IPv6'],
    ['http://[0:0:0:0:0:0:0:1]/', '::1 bentuk panjang'],
    ['file:///C:/Windows/win.ini', 'skema berkas'],
    ['javascript:alert(1)', 'skema javascript'],
    ['bukan-url', 'bukan URL'],
  ] as [string, string][]) {
    cek(!(await alamatAman(u)), `${u.slice(0, 34).padEnd(34)} ${ket}`);
  }

  console.log('\n  ── ALAMAT HARUS DITERIMA ──');
  for (const u of [
    'https://ketik.com/serang/berita',
    'https://travel.detik.com/travel-news/d-8552848/judul',
    'https://mediabanten.com/artikel',
    'https://news.google.com/rss/articles/CBMi',
  ]) cek(await alamatAman(u), u.slice(0, 52));

  console.log('\n  ── fetchAman MENOLAK, BUKAN DIAM-DIAM MENGAMBIL ──');
  for (const u of ['http://169.254.169.254/', 'http://localtest.me/']) {
    try {
      await fetchAman(u, { signal: AbortSignal.timeout(5000) });
      cek(false, `${u} — TIDAK dilempar!`);
    } catch (e) {
      cek((e as Error).message === 'alamat tidak diizinkan', `${u} → "${(e as Error).message}"`);
    }
  }

  console.log('\n  ── FAIL-CLOSED SAAT DNS BERMASALAH ──');
  for (const [u, ket] of [
    ['http://domain-ini-pasti-tidak-ada-12345678.com/', 'domain tidak ada'],
    ['http://a.b.c.d.e.tidak-ada-sama-sekali-xyz/', 'TLD tidak ada'],
  ] as [string, string][]) {
    cek(!(await alamatAman(u)), `${ket.padEnd(20)} → ditolak`);
    try {
      await fetchAman(u, { signal: AbortSignal.timeout(8000) });
      cek(false, `${ket} — fetchAman TIDAK melempar!`);
    } catch (e) {
      cek((e as Error).message === 'alamat tidak diizinkan', `${ket.padEnd(20)} → fetchAman melempar`);
    }
  }
  // Nama acak = dijamin belum di cache, jadi butuh perjalanan jaringan.
  // Dengan batas 1 ms, biasanya pembatas waktu yang menang — TAPI resolver OS
  // kadang membalas NXDOMAIN lebih cepat dari 1 ms. Dua-duanya sama-sama benar:
  // yang WAJIB dijamin adalah ia MELEMPAR, bukan diam-diam mengembalikan alamat.
  // Dulu di sini dicocokkan teks pesannya, dan ujinya jadi merah acak-acakan.
  const acak = `${Math.random().toString(36).slice(2)}.ketik.com`;
  let melempar = false;
  let pesan = '(tidak melempar)';
  try {
    await lookupBerbatas(acak, 1);
  } catch (e) {
    melempar = true;
    pesan = (e as Error).message;
  }
  cek(melempar, `DNS batas 1 ms       → melempar, tidak mengembalikan alamat ("${pesan}")`);
  cek(!(await alamatAman(`https://${acak}/berita`, 1)), 'DNS kehabisan waktu  → alamatAman menolak');
  cek(await alamatAman('https://ketik.com/berita'), 'DNS normal           → tetap diterima');

  console.log('\n  ── urlAman (pemeriksaan bentuk saja) ──');
  cek(urlAman('https://contoh.com/a'), 'https diterima');
  cek(!urlAman('ftp://contoh.com/a'), 'ftp ditolak');
  cek(!urlAman(123 as unknown), 'bukan string ditolak');

  console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
  process.exit(gagal === 0 ? 0 : 1);
})();
