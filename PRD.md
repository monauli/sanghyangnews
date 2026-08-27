# PRD — Sanghyang News Scraper

**Versi:** 2.0 — direvisi setelah riset teknis (spike v1–v5)
**Tanggal:** 25 Agustus 2026
**Status:** Disetujui, implementasi berjalan

> **Catatan revisi.** v1.0 ditulis sebelum riset teknis. Semua angka di dokumen ini sekarang berasal dari pengujian nyata, bukan perkiraan. Strategi keyword di §11 diganti total.

---

## 1. Latar Belakang

Tim Sanghyang Resort (Jl. Raya Sirih Km. 128, Cikoneng, Anyer, Banten) membuat newsletter internal **"Sanghyang Highlights"** berisi kumpulan berita di sekitar wilayah hotel. **Terbit bulanan.**

Proses saat ini 100% manual: browsing portal satu per satu → copy artikel relevan → rangkum manual → layout manual → export PDF.

Referensi output: `Newsletter_Sanghyang_July.pdf` — 6 halaman, 5 artikel, dwibahasa.

## 2. Masalah

| Masalah | Dampak |
|---|---|
| Cari berita manual berjam-jam | Newsletter sering telat terbit |
| Tidak ada standar rentang tanggal | Berita kelewat atau dobel dari edisi sebelumnya |
| Rangkum + layout manual | Rawan typo & error |
| Tidak ada arsip terstruktur | Susah cek berita mana yang sudah dipakai |

**Bukti error manual di PDF referensi:**

1. **Halaman 6** — kalimat sisa AI translator lolos ke publikasi: *"This translation preserves the original meaning while maintaining a neutral, professional tone appropriate for news reporting."*
2. **Halaman 3** — typo instansi: "Dinas Satuan **Pomong** Praja (**Satpoll** PP)", seharusnya *Satuan Polisi Pamong Praja (Satpol PP)*
3. **Header** — tanggal campur bahasa: "Kamis, 25 June 2026"
4. **Brand** — penulisan tidak konsisten: Mövenpick vs Movenpick
5. **Gambar** — sisa tombol UI screenshot "⛶ Perbesar" di foto Chandra Asri

Kelima hal ini jadi acuan langsung untuk desain aplikasi: masalah 1 → sanitizer wajib, masalah 2 → aturan ejaan di prompt, masalah 3 → format tanggal dikunci.

## 3. Tujuan

Web app: **pilih bulan → otomatis cari berita relevan → user pilih & edit → export PDF.**

Target: dari berjam-jam jadi **di bawah 15 menit**.

## 4. Pengguna

Staff marketing/komunikasi Sanghyang Resort. Bukan orang teknis. Butuh UI simpel tanpa istilah teknis, dan harus bisa mengoreksi hasil AI sebelum export.

## 5. Scope v1

### ✅ Masuk
- Input rentang tanggal + tombol cepat (Bulan Lalu / Bulan Ini / 30 Hari)
- Auto-search 19 query via Google News RSS
- Filter otomatis + **sistem skoring relevansi**
- Ambil isi artikel + gambar
- Summary otomatis Bahasa Indonesia (Gemini)
- Halaman review: pilih, edit, ganti gambar, input manual saat gagal
- Export PDF + link sumber asli

### ❌ Tidak masuk (v2+)
Versi Bahasa Inggris · database & arsip · login · scheduling otomatis · edit keyword dari UI · kirim email

## 6. Alur Pengguna

```
[1] Klik "Bulan Lalu"  →  klik "Cari Berita"
              ↓
[2] Sistem cari & skor (~30 detik)
              ↓
[3] Tampil ⭐ Berita Utama (28 artikel, terurut relevansi)
    User centang 4-5 → sistem ambil isi & rangkum otomatis
    User koreksi ringkasan kalau perlu
              ↓
[4] Klik "Buat Newsletter"  →  preview
              ↓
[5] Klik "Download PDF"
```

**Prinsip: TIDAK full-otomatis.** Step 3 wajib ada. Ini yang mencegah error seperti kalimat translator yang lolos di PDF referensi.

## 7. Kriteria Sukses

- [x] 19 query berjalan tanpa mentok batas 100 artikel Google — **tercapai: 0/19 mentok**
- [x] Resolver mengembalikan URL portal asli — **tercapai: 10/10, 0.56 dtk/artikel**
- [x] Mayoritas portal bisa di-scrape — **tercapai: 8/10**
- [x] 20 artikel teratas relevan untuk newsletter hotel — **tercapai setelah revisi skoring**
- [ ] Summary AI layak pakai dengan edit minor — **belum diuji**
- [ ] PDF ter-generate < 10 detik
- [ ] Link di PDF mengarah ke portal asli, bukan Google
- [ ] Total proses end-to-end < 15 menit

## 8. Keputusan Teknis

| Item | Pilihan | Alasan |
|---|---|---|
| Sumber berita | Google News RSS | Gratis, tanpa API key, filter tanggal jalan |
| Resolver URL | Endpoint `batchexecute` | Satu-satunya cara yang berhasil (lihat §9) |
| AI Summary | Gemini API free tier | Gratis, ~5 call/newsletter, jauh di bawah kuota |
| Framework | Next.js App Router + TypeScript | Frontend + backend satu repo |
| Database | **Tidak ada di v1** | State cukup di sessionStorage |
| PDF | Puppeteer (HTML → PDF) | Layout pakai HTML/CSS, presisi |

**Total biaya operasional: Rp 0.**

## 9. Risiko

| Risiko | Level | Mitigasi |
|---|---|---|
| **`batchexecute` adalah API internal Google, bukan API resmi** — bisa berubah sewaktu-waktu tanpa pemberitahuan | 🔴 Tinggi | Fallback input URL manual wajib ada. Newsletter tidak boleh mati total |
| Sebagian portal blokir scraping | 🟡 Sedang | Sudah teridentifikasi: `lifestyle.bisnis.com` (403), `infoekonomi.id` (timeout). Fallback tempel teks manual |
| Kualitas summary Gemini **belum teruji** | 🟡 Sedang | Baru ketahuan saat implementasi. Prompt bisa disetel; review manual jadi pengaman |
| Skoring meloloskan artikel tidak relevan | 🟢 Rendah | Bobot ada di file config, mudah disetel sambil pakai |
| Kuota free tier Gemini berubah | 🟢 Rendah | Volume sangat kecil. Kalau perlu aktifkan billing, biayanya receh |

## 10. Catatan Legal

Aplikasi hanya membuat **ringkasan + link ke sumber asli** — praktik standar aggregator, aman secara hak cipta.

**Aturan keras:** engine summary tidak boleh menyalin paragraf utuh. Dikunci lewat prompt Gemini + sanitizer (`BACKEND.md` §9). Setiap artikel di PDF **wajib** mencantumkan URL sumber.

## 11. Strategi Pencarian

> **v1.0 SALAH.** Strategi lama (7 query per lokasi) membuat Serang/Cilegon/Banten mentok di batas 100 artikel Google, dan kuotanya habis kepakai berita generik seperti rapat DPRD dan mutasi pegawai.

### Query — 19 total

| Kelompok | Lokasi | Cara |
|---|---|---|
| Kecil | Anyer, Carita, Cinangka, Cikoneng | Query sendiri (semua beritanya memang lokal) |
| Besar | Serang, Cilegon, Banten | **× 5 topik**: wisata, hotel resort, investasi, pariwisata, festival |

Terbukti: 0/19 query mentok.

### Filter keras (dibuang)
- **Blacklist** — musibah, kriminal, olahraga, politik praktis
- **Lokasi wajib ada di judul**, bukan hanya di isi. Membuang berita seperti *"warga Depok wisata ke Anyer"*

### Skoring (menggantikan filter topik)

Filter topik keras dihapus — terbukti meloloskan listicle SEO yang secara teknis memang membahas wisata.

| Kategori | Nilai |
|---|---|
| 🏖 Wisata inti | +5 |
| 💰 Ekonomi & infrastruktur | +3 |
| 🎪 Acara | +3 |
| 🏛 Pejabat | +2 |
| 📋 Birokrasi internal (raperda, APBD, mutasi, BPK) | **−6** |
| 📰 Listicle SEO | −4 per kata |
| 🔢 Judul diawali angka | −5 |
| ❗ Ada `!` atau `?` | −3 |
| ✳️ Ditemukan di banyak query | +2 |

**Pelajaran penting:** yang menentukan relevansi adalah **tema**, bukan ada-tidaknya pejabat. Percobaan awal memberi nilai positif ke kata pemerintahan, hasilnya 10 teratas isinya "Raperda Pertanggungjawaban APBD" dan "Mutasi Sekwan" — tidak ada nilainya untuk hotel.

Detail bobot: `BACKEND.md` §7. Konstanta: `config/keywords.ts` (disalin apa adanya dari `spike5.mjs`).

## 12. Volume Terukur

Uji nyata, 19 query × 1 bulan (Juni 2026, diukur 27 Agustus 2026):

```
763 artikel mentah
 ↓ dedupe antar query (34% dobel)
503 unik
 ↓ portal iklan (2) + blacklist (33) + regional (46) + lokasi tak di judul (194)
228 lolos          ← 15 di antaranya ditandai serupa
 ↓ skoring
 23 🟢 Tinggi   ← tampil default
 59 🟡 Sedang   ← tertutup
146 ⚪ Rendah   ← tersembunyi
```

Newsletter butuh 4–5 artikel. **23 kandidat teratas sudah lebih dari cukup.**

Angka di atas satu potret, bukan konstanta — lihat catatan di §13.

## 13. Validasi

> **Google News tidak deterministik.** Tiga pemanggilan rentang yang sama di
> hari yang sama memberi 763, 800, dan 801 artikel mentah. Artikel bisa hilang
> atau muncul antar pemanggilan, dan skornya ikut bergeser karena bonus
> “ditemukan di banyak query” bergantung pada apa yang kebetulan terambil.
>
> **Tabel ini panduan, bukan uji yang harus selalu hijau.** Yang perlu
> dicurigai bukan satu baris yang meleset, tapi pola: grup Tinggi anjlok jauh
> dari ~20-an, atau beberapa baris hilang sekaligus. Untuk uji yang benar-benar
> harus hijau, pakai `scripts/test-filter.ts` — datanya buatan sendiri, tidak
> menyentuh jaringan.

Uji rentang **1–30 Juni 2026** dengan `npx tsx scripts/test-pipeline.ts`.
Artikel berikut harus muncul di grup Berita Utama (diukur 27 Agustus 2026):

| Artikel | Sumber | Skor |
|---|---|---|
| Exciting Banten Festival 2026 Hadir di Anyer | ketik.com | 18 |
| Mendes PDT Siapkan Bantuan Pengembangan Desa Wisata di Banten | MediaBanten.Com | 14 |
| Ritual Ruwat Laut Pesta Laut Carita 2026 Jadi Magnet Wisata | Gerbang Patriot | 13 |
| Aston Cilegon Boutique Hotel Sajikan Sensasi Kuliner Jepang | CYBER88 | 12 |
| Andra Soni: Anyer Harus Kembali Jadi Top of Mind Wisatawan | Faktabanten.co.id | 12 |
| Libur Idul Adha 2026, Okupansi Hotel di Anyer-Cinangka Tembus 100 Persen | Faktabanten.co.id | 12 |

Yang berubah sejak tabel pertama (spike, Juni 2026):

- **Movenpick Resort Carita — tidak lagi bisa diuji.** Artikel yang dicatat waktu
  spike (skor 12) sudah tidak ada di korpus. Yang tersisa judulnya lain, “Ini
  Fasilitas Movenpick Resort Carita di Banten” (detikTravel), dan skornya 7:
  judulnya tidak memuat kata bertema selain “fasilitas”. Bukan regresi — memang
  artikel yang berbeda. Digantikan baris Okupansi Hotel Anyer-Cinangka.
- **Aston pindah sumber**, dari radarbanten.co.id ke CYBER88, dan skornya 15 → 12.
  Nama sumber tidak lagi ikut diskor sejak judul RSS dibersihkan di akarnya
  (`lib/judul.ts`), jadi skor yang lama memang kelebihan.
- **Skor bergeser 1–3 poin** di beberapa baris karena bonus “banyak query”
  bergantung pada apa yang terambil hari itu.

Yang **tidak boleh** muncul di grup atas: Raperda, Mutasi Sekwan, Monev Beasiswa,
Temuan BPK, dan listicle seperti “Butuh Weekend Escape?” atau “5 Tempat Wisata
Terbaik”. Yang **tidak boleh lolos sama sekali**: Tulungagung, Sungai Serang
(Blitar), Larung Sedekah, Cipondoh, Tangerang. Kedua daftar itu dicek otomatis
oleh `scripts/test-pipeline.ts`.

## 14. Performa Terukur

| Tahap | Waktu |
|---|---|
| 19 query RSS | ~25 detik |
| Filter + skoring | < 1 detik |
| Resolve per artikel | 0.56 detik |
| Extract per artikel | 1–3 detik |
| Summary per artikel | 2–5 detik (perkiraan) |

**Total realistis:** cari ~30 detik + proses 5 artikel terpilih ~30 detik.

---

## Referensi

- `BACKEND.md` v2.0 — spesifikasi API & modul
- `FRONTEND.md` v2.0 — spesifikasi halaman & komponen
- `spike3.mjs` — riset resolver & `FULL_HEADERS`; sudah diterapkan di `lib/resolver.ts` dan `lib/extractor.ts`
- `spike5.mjs` — riset konstanta skoring, blacklist, strategi query; sudah diterapkan di `config/keywords.ts`

Kedua berkas spike disimpan sebagai catatan riset. **Yang berlaku adalah kode di
`lib/` dan `config/`** — keduanya sudah berbeda dari spike (mis. ambang duplikat,
penguat lokasi, pembersih judul).
