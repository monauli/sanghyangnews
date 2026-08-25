/**
 * Penjaga URL untuk semua fetch sisi server yang alamatnya datang dari browser.
 *
 * Tanpa ini, siapa pun yang bisa memanggil API kita bisa menyuruh server menembak
 * alamat jaringan internal (mis. 169.254.169.254 milik cloud metadata) dan
 * memulangkan isinya lewat teks artikel atau gambar di PDF.
 *
 * Satu berkas supaya tidak ada route yang lupa memakainya — /api/export dulu lupa,
 * dan itu baru ketahuan lewat pemeriksaan keamanan.
 */

const TERLARANG = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,        // link-local & metadata cloud
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[/,                // IPv6 literal, termasuk [::1]
  /^::1?$/,
  /\.local$/i,
  /\.internal$/i,
];

export function urlAman(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return !TERLARANG.some((p) => p.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Alamat awal boleh aman tapi berakhir di tempat lain lewat redirect.
 * Panggil ini atas `res.url` SEBELUM membaca isinya.
 *
 * ponytail: pemeriksaan sesudah fetch, bukan sebelum — request-nya sudah terlanjur
 * terkirim. Cukup untuk mencegah kebocoran isi; kalau nanti butuh mencegah
 * request-nya sama sekali, pakai redirect: 'manual' lalu validasi tiap lompatan.
 */
export const hasilAman = (res: Response) => urlAman(res.url);
