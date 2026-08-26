/**
 * Antrian dengan batas jumlah pekerjaan bersamaan.
 *
 * Dipisah dari halaman review supaya bisa diuji sendiri: antrian berbasis
 * daftar resolver seperti ini gagal secara diam-diam (macet, bukan error)
 * kalau slot tidak dilepas saat pekerjaan melempar exception.
 */
export function batasi(maks: number) {
  let jalan = 0;
  const antre: (() => void)[] = [];

  /** `saatMengantre` hanya dipanggil kalau memang harus menunggu. */
  return async function gerbang<T>(f: () => Promise<T>, saatMengantre?: () => void): Promise<T> {
    if (jalan >= maks) {
      saatMengantre?.();
      await new Promise<void>((lanjut) => antre.push(lanjut));
    }
    jalan++;
    try {
      return await f();
    } finally {
      jalan--;
      antre.shift()?.();
    }
  };
}
