/**
 * Penjaga URL untuk semua fetch sisi server yang alamatnya datang dari browser.
 *
 * Tanpa ini, siapa pun yang bisa memanggil API kita bisa menyuruh server menembak
 * alamat jaringan internal (mis. 169.254.169.254 milik cloud metadata) dan
 * memulangkan isinya lewat teks artikel atau gambar di PDF.
 *
 * Pemeriksaan nama host saja TIDAK CUKUP: `localtest.me` dan `*.nip.io` adalah
 * nama biasa yang resolve ke 127.0.0.1. Karena itu alamatnya di-resolve dulu,
 * lalu nomor IP hasilnya yang diperiksa.
 *
 * Satu berkas supaya tidak ada route yang lupa memakainya — /api/export dulu lupa.
 */
import { lookup } from 'node:dns/promises';

// ---------- pemeriksaan nomor IP ----------

const keAngka = (v4: string) =>
  v4.split('.').reduce((n, oktet) => n * 256 + Number(oktet), 0) >>> 0;

const dalamBlok = (ip: number, blok: string) => {
  const [alamat, bit] = blok.split('/');
  const topeng = Number(bit) === 0 ? 0 : (0xffffffff << (32 - Number(bit))) >>> 0;
  return (ip & topeng) >>> 0 === (keAngka(alamat) & topeng) >>> 0;
};

/** Rentang yang tidak boleh disentuh dari internet publik. */
const BLOK_V4 = [
  '0.0.0.0/8',        // "alamat ini"
  '10.0.0.0/8',       // privat
  '100.64.0.0/10',    // CGNAT
  '127.0.0.0/8',      // loopback
  '169.254.0.0/16',   // link-local & metadata cloud
  '172.16.0.0/12',    // privat
  '192.0.0.0/24',     // IETF
  '192.168.0.0/16',   // privat
  '198.18.0.0/15',    // benchmark
  '224.0.0.0/4',      // multicast
  '240.0.0.0/4',      // dicadangkan
];

export function ipTerlarang(ip: string): boolean {
  const bersih = ip.replace(/^\[|\]$/g, '').toLowerCase();

  if (bersih.includes(':')) {
    const v4Terpeta = bersih.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Terpeta) return ipTerlarang(v4Terpeta[1]);
    if (bersih === '::' || bersih === '::1') return true;          // loopback
    if (/^f[cd]/.test(bersih)) return true;                        // ULA fc00::/7
    if (/^fe[89ab]/.test(bersih)) return true;                     // link-local fe80::/10
    return !/^[23]/.test(bersih);                                  // selain global unicast: tolak
  }

  if (!/^\d+\.\d+\.\d+\.\d+$/.test(bersih)) return true;           // bukan IPv4 yang dikenali
  return BLOK_V4.some((b) => dalamBlok(keAngka(bersih), b));
}

// ---------- pemeriksaan alamat ----------

/**
 * Pemeriksaan bentuk saja — murah, dipakai route untuk menolak lebih awal
 * dengan HTTP 400. Penegakan sebenarnya ada di fetchAman().
 */
export function urlAman(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const { protocol } = new URL(u);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export const BATAS_DNS = 5000;

/**
 * dns.lookup() memakai resolver sistem operasi: tidak punya batas waktu sendiri
 * dan TIDAK menuruti AbortSignal milik pemanggil. Kalau resolvernya menggantung,
 * pemeriksaan ini ikut menggantung tanpa batas — batas 12 detik di extractor
 * baru berlaku setelah fetch dimulai. Karena itu dibatasi di sini.
 */
export async function lookupBerbatas(host: string, batas = BATAS_DNS) {
  let jam: NodeJS.Timeout;
  const kehabisanWaktu = new Promise<never>((_, tolak) => {
    jam = setTimeout(() => tolak(new Error('DNS kehabisan waktu')), batas);
    jam.unref?.();
  });
  try {
    return await Promise.race([lookup(host, { all: true }), kehabisanWaktu]);
  } finally {
    clearTimeout(jam!);
  }
}

/**
 * Bentuk + hasil resolve DNS. Ditolak kalau SATU saja alamatnya masuk rentang terlarang.
 *
 * FAIL-CLOSED: apa pun yang salah — domain tidak ada, DNS mati, DNS lambat,
 * jaringan putus — hasilnya `false`. Tidak pernah "ya sudah, lanjut saja".
 */
export async function alamatAman(u: string, batasDns = BATAS_DNS): Promise<boolean> {
  if (!urlAman(u)) return false;
  const { hostname } = new URL(u);
  const polos = hostname.replace(/^\[|\]$/g, '');

  // IP literal: langsung periksa, tidak perlu DNS.
  if (/^[\d.]+$/.test(polos) || polos.includes(':')) return !ipTerlarang(polos);

  try {
    const hasil = await lookupBerbatas(polos, batasDns);
    return hasil.length > 0 && !hasil.some((a) => ipTerlarang(a.address));
  } catch {
    return false;   // tidak bisa di-resolve = tidak dipakai
  }
}

/**
 * Pengganti fetch() untuk semua alamat yang datang dari browser.
 * Redirect diikuti manual supaya TIAP lompatan diperiksa — host yang diizinkan
 * tidak bisa dipakai sebagai batu loncatan ke 169.254.169.254.
 *
 * ponytail: masih ada celah DNS rebinding (alamat bisa berubah antara pemeriksaan
 * dan fetch). Menutupnya perlu menyambung langsung ke IP hasil resolve sambil
 * mengirim header Host — kerjakan kalau alat ini pernah dibuka ke jaringan luar.
 */
export async function fetchAman(
  url: string,
  init: RequestInit = {},
  maksLompatan = 4,
): Promise<Response> {
  let kini = url;

  for (let i = 0; i <= maksLompatan; i++) {
    if (!(await alamatAman(kini))) throw new Error('alamat tidak diizinkan');

    const res = await fetch(kini, { ...init, redirect: 'manual' });
    if (res.status < 300 || res.status > 399) return res;

    const tujuan = res.headers.get('location');
    if (!tujuan) return res;
    kini = new URL(tujuan, kini).href;
  }

  throw new Error('terlalu banyak pengalihan');
}
