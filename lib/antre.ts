/**
 * Antrian dengan batas jumlah pekerjaan bersamaan.
 *
 * Dipisah dari halaman review supaya bisa diuji sendiri: antrian berbasis
 * daftar resolver seperti ini gagal secara diam-diam (macet, bukan error)
 * kalau slot tidak dilepas saat pekerjaan melempar exception.
 */
/**
 * @param maks         berapa pekerjaan boleh jalan bersamaan
 * @param jedaMinimal  jarak minimal antar-MULAI pekerjaan, dalam milidetik.
 *
 * Batas jumlah bersamaan saja tidak cukup menjaga laju: kalau modelnya cepat,
 * 2 slot x balasan 1 detik tetap jadi ~120 permintaan/menit. Jeda minimal
 * mengunci lajunya ke angka yang tidak bergantung pada kecepatan model —
 * penting karena modelnya sekarang bisa diganti lewat env.
 */
export function batasi(maks: number, jedaMinimal = 0) {
  let jalan = 0;
  let mulaiTerakhir = 0;
  const antre: (() => void)[] = [];
  const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** `saatMengantre` hanya dipanggil kalau memang harus menunggu. */
  return async function gerbang<T>(f: () => Promise<T>, saatMengantre?: () => void): Promise<T> {
    const sisa = () => jedaMinimal - (Date.now() - mulaiTerakhir);
    if (jalan >= maks || sisa() > 0) {
      saatMengantre?.();
      if (jalan >= maks) await new Promise<void>((lanjut) => antre.push(lanjut));
    }
    // Dicek ulang SETELAH dapat slot: giliran bisa datang tepat setelah
    // pekerjaan lain baru saja mulai.
    for (let t = sisa(); t > 0; t = sisa()) await tidur(t);
    mulaiTerakhir = Date.now();
    jalan++;
    try {
      return await f();
    } finally {
      jalan--;
      antre.shift()?.();
    }
  };
}
