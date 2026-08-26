/** Uji antrian berbatas. Jalankan: npx --yes tsx scripts/test-antre.ts */
import { batasi } from '../lib/antre';

let gagal = 0;
const cek = (ok: boolean, label: string) => {
  if (!ok) gagal++;
  console.log(`  ${ok ? '✅' : '🔴 SALAH'} ${label}`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. Puncak jumlah bersamaan tidak boleh melewati batas.
  {
    const gerbang = batasi(3);
    let jalan = 0;
    let puncak = 0;
    const urutanSelesai: number[] = [];
    const t0 = Date.now();
    await Promise.all(
      [...Array(9).keys()].map((i) =>
        gerbang(async () => {
          jalan++;
          puncak = Math.max(puncak, jalan);
          await sleep(100);
          jalan--;
          urutanSelesai.push(i);
        })
      )
    );
    const lama = Date.now() - t0;
    console.log(`  9 pekerjaan @100ms, batas 3 → puncak ${puncak}, ${lama}ms`);
    cek(puncak === 3, 'tidak pernah lebih dari 3 bersamaan');
    cek(lama >= 280 && lama < 700, `selesai ~300ms (3 gelombang), bukan ~900ms sekuensial`);
    cek(urutanSelesai.length === 9, 'semua 9 pekerjaan selesai');
  }

  // 2. Pekerjaan yang gagal harus tetap melepas slotnya, kalau tidak antrian macet.
  {
    const gerbang = batasi(2);
    const hasil = await Promise.allSettled([
      gerbang(async () => { await sleep(30); throw new Error('meledak'); }),
      gerbang(async () => { await sleep(30); throw new Error('meledak'); }),
      gerbang(async () => { await sleep(30); return 'ok'; }),
      gerbang(async () => { await sleep(30); return 'ok'; }),
    ]);
    cek(hasil[0].status === 'rejected', 'exception diteruskan ke pemanggil, tidak ditelan');
    cek(hasil.filter((h) => h.status === 'fulfilled').length === 2,
      'pekerjaan setelah yang gagal tetap jalan (slot dilepas)');
  }

  // 3. saatMengantre hanya untuk yang benar-benar menunggu.
  {
    const gerbang = batasi(2);
    let mengantre = 0;
    await Promise.all(
      [...Array(5).keys()].map(() =>
        gerbang(() => sleep(50), () => { mengantre++; })
      )
    );
    console.log(`  5 pekerjaan, batas 2 → ${mengantre} kartu sempat "Menunggu giliran…"`);
    cek(mengantre === 3, '2 langsung jalan, 3 sisanya mengantre');
  }

  // 4. Nilai kembalian tidak tertukar antar pekerjaan.
  {
    const gerbang = batasi(3);
    const out = await Promise.all(
      [...Array(7).keys()].map((i) => gerbang(async () => { await sleep(10 * (7 - i)); return i; }))
    );
    cek(out.join(',') === '0,1,2,3,4,5,6', 'hasil tiap pekerjaan kembali ke pemanggilnya sendiri');
  }

  // 5. Jeda minimal: laju harus terkunci walau pekerjaannya selesai seketika.
  {
    const gerbang = batasi(2, 200);
    const mulai: number[] = [];
    const t0 = Date.now();
    await Promise.all(
      [...Array(6).keys()].map(() => gerbang(async () => { mulai.push(Date.now() - t0); }))
    );
    mulai.sort((a, b) => a - b);
    const jarak = mulai.slice(1).map((t, i) => t - mulai[i]);
    const terrapat = Math.min(...jarak);
    console.log(`  6 pekerjaan seketika, jeda 200ms → jarak antar-mulai terrapat ${terrapat}ms`);
    cek(terrapat >= 195, 'tidak ada dua pekerjaan mulai lebih rapat dari jeda minimal');
    cek(Date.now() - t0 >= 1000, 'laju terkunci walau pekerjaannya nol detik (>=5x200ms)');
  }

  // 6. Tanpa jeda, perilaku lama harus utuh.
  {
    const gerbang = batasi(2);
    const t0 = Date.now();
    await Promise.all([...Array(4).keys()].map(() => gerbang(() => sleep(50))));
    cek(Date.now() - t0 < 250, 'jedaMinimal=0 tidak menambah perlambatan');
  }

  console.log(`\n  ${gagal === 0 ? '✅ semua benar' : `🔴 ${gagal} salah`}`);
  process.exit(gagal === 0 ? 0 : 1);
})();
