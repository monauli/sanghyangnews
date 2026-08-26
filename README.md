# Sanghyang Highlights

Alat untuk membuat newsletter berita bulanan Sanghyang Resort.
Pilih bulannya, sistem mencarikan beritanya, kamu pilih dan periksa, lalu unduh PDF-nya.

Biasanya selesai dalam 5–10 menit.

---

## Cara menjalankan

**Klik dua kali `Jalankan Sanghyang.bat`** di folder ini.

Akan muncul jendela hitam, lalu browser terbuka sendiri ke alatnya.
Tidak perlu mengetik apa pun.

> **Jendela hitam itu jangan ditutup** selama kamu memakai alatnya.
> Itu bukan error — di situlah alatnya berjalan. Kalau ditutup, alatnya mati.

Setelah PDF-nya terunduh dan kamu sudah selesai, tutup browser lalu tutup
jendela hitam itu.

Kalau browsernya tidak terbuka sendiri, buka browser dan ketik alamat ini:
`http://localhost:3000`

### Kalau muncul tulisan "BELUM SIAP DIJALANKAN"

Artinya alatnya belum selesai dipasang di komputer itu.
Klik dua kali **`Setup Pertama Kali.bat`**, tunggu sampai muncul
`SETUP SELESAI`, baru jalankan lagi `Jalankan Sanghyang.bat`.

`Setup Pertama Kali.bat` cuma perlu dijalankan **sekali seumur pemasangan**.

---

## Cara pakai

### Langkah 1 — Pilih bulan

Saat halaman dibuka, tanggalnya sudah otomatis terisi **bulan lalu** — biasanya itu
yang kamu butuhkan. Kalau mau bulan lain, ubah tanggalnya atau pakai tombol
**Bulan Ini** / **30 Hari Terakhir**.

Klik **Cari Berita**. Tunggu sekitar 10–30 detik. Jangan tutup tabnya.

### Langkah 2 — Pilih berita

Berita dikelompokkan jadi tiga:

| Kelompok | Isi |
|---|---|
| ⭐ **Berita Utama** | Paling cocok untuk newsletter — **mulai dari sini** |
| **Berita Lain** | Masih relevan, buka kalau Berita Utama kurang |
| **Kurang Relevan** | Kemungkinan besar tidak terpakai |

**Centang 4–5 berita** yang mau dipakai. Setiap kali kamu mencentang satu berita,
sistem akan mengambil isinya dan membuat ringkasan otomatis. Ini butuh
**10–40 detik per berita** — tulisan di kartunya akan memberi tahu sedang apa.

Label kecil berwarna hijau (🏖 Wisata, 💰 Ekonomi, dan sebagainya) menjelaskan
kenapa berita itu muncul.

### Langkah 3 — Periksa dan perbaiki

Klik **Lihat & Edit** pada berita yang sudah dicentang. Di situ kamu bisa:

- Memperbaiki **judul**
- Memperbaiki **ringkasan** (jumlah katanya terlihat di pojok kanan)
- **Mengganti gambar** kalau gambarnya kurang bagus
- Memperbaiki **link sumber**
- Menekan **Buat Ulang Ringkasan** kalau hasilnya kurang pas

### Langkah 4 — Susun dan unduh

Klik **Buat Newsletter**. Di halaman berikutnya kamu bisa:

- Mengubah **tanggal terbit**
- Mengubah **urutan artikel** dengan tombol ↑ dan ↓
- Melihat **pratinjau** — tampilannya persis seperti PDF nanti

Terakhir klik **Download PDF**.

---

## ⚠️ Peringatan penting

### 1. Jangan tutup tab sebelum PDF terunduh

Semua pekerjaanmu tersimpan di tab browser itu saja. Kalau tabnya ditutup atau
browsernya dimatikan sebelum PDF selesai diunduh, **semuanya hilang** dan kamu
harus mengulang dari awal.

### 2. SELALU baca ulang ringkasannya sebelum mengunduh

Ringkasan dibuat oleh AI. **AI bisa salah** — salah nama, salah angka, salah tanggal,
atau menulis kalimat yang tidak ada di berita aslinya.

Newsletter ini membawa nama Sanghyang. Baca setiap ringkasan sampai habis
sebelum mengunduh. Ini bagian pekerjaanmu, bukan pekerjaan komputer.

Perhatikan khusus label ini:

- **⚠️ Sumber terbatas** — berita aslinya pendek, ringkasannya lebih rawan salah.
  Periksa lebih teliti.
- **⚠️ Mirip dengan berita #…** — ada berita lain yang isinya serupa.
  Pilih salah satu saja supaya tidak dobel.
- **⚠️ Gambar resolusi rendah** — gambarnya akan terlihat pecah di PDF.
  Sebaiknya diganti.

### 3. Kalau ada banner kuning di atas halaman

Kalau muncul tulisan **"Sebagian pencarian gagal — hasil mungkin tidak lengkap"**,
artinya ada berita yang mungkin tidak ikut terkumpul. Kalau berita yang kamu cari
tidak ketemu, kembali ke halaman awal dan **ulangi pencariannya**.

### 4. Kalau PDF gagal terunduh

Kalau komputermu punya **Internet Download Manager (IDM)**, matikan dulu IDM-nya
lalu coba unduh lagi. IDM suka mencegat unduhan PDF sampai berkasnya jadi kosong.

---

## Kalau ada masalah

| Yang terjadi | Yang harus dilakukan |
|---|---|
| **"Link belum bisa dipastikan"** | Buka **Lihat & Edit**, buka beritanya sendiri di browser, salin alamatnya, tempel ke kolom **Link sumber**, lalu klik **Ambil Ulang dari Link** |
| **"Situs ini tidak bisa dibaca otomatis"** | Ada situs berita yang memblokir. Buka **Lihat & Edit**, buka beritanya di browser, salin isi beritanya, tempel ke kotak yang muncul, lalu klik **Buat Ulang Ringkasan** |
| **"Gagal merangkum"** | Klik **Buat Ulang Ringkasan**. Kalau masih gagal, tulis sendiri ringkasannya di kotak itu — hasilnya tetap bisa masuk PDF |
| **Gambarnya kosong** | Klik **Upload gambar** dan pilih gambar sendiri (JPG/PNG, maksimal 5 MB) |
| **Tombol "Buat Newsletter" abu-abu** | Ada berita terpilih yang belum punya ringkasan atau belum punya link. Tulisan di atas tombol memberi tahu berapa yang belum siap |
| **Berita yang dicari tidak ada** | Coba buka kelompok **Berita Lain**. Kalau tetap tidak ada, ulangi pencarian |
| **Pencarian sangat lama (>2 menit)** | Tutup tab, buka lagi `http://localhost:3000`, ulangi |
| **Halaman kosong / error** | Kembali ke `http://localhost:3000` dan mulai lagi dari awal |
| **Jendela hitamnya tertutup sendiri** | Buka lagi `Jalankan Sanghyang.bat`. Pekerjaan di tab browser hilang, harus mulai dari awal |
| **"APLIKASI SUDAH BERJALAN"** | Bukan error. Kamu klik `Jalankan Sanghyang.bat` dua kali. Browser sudah dibuka; tutup jendela yang baru ini saja, **jangan tutup yang satunya** |
| **"ALAMATNYA SEDANG DIPAKAI PROGRAM LAIN"** | Ada program lain yang memakai `localhost:3000`. Tutup program itu, atau restart komputer, lalu coba lagi |

---

## Cara memasang di komputer baru

### Yang dikirim

Salin folder aplikasi ini ke komputer tujuan (flashdisk, Google Drive, apa saja),
**tapi hapus dulu tiga hal ini sebelum menyalin:**

| Jangan ikut dikirim | Kenapa |
|---|---|
| `node_modules/` | Ratusan MB, dan isinya khusus per komputer. `Setup Pertama Kali.bat` mengunduhnya sendiri |
| `.next/` | Hasil build lama. Ikut dibuat ulang saat setup |
| `.env.local` | **Berisi kunci Gemini dan sandi.** Kirim terpisah, atau biarkan setup membuat yang kosong lalu isi di tempat |

Tanpa ketiganya, folder yang dikirim tinggal beberapa MB.

> **Soal `.env.local`:** kalau komputer baru itu memakai kunci Gemini yang sama,
> boleh dikirim (lewat jalur pribadi, jangan lewat chat grup). Kalau kuncinya
> beda, **jangan dikirim** — biarkan `Setup Pertama Kali.bat` membuat berkas
> kosong, lalu isi langsung di komputer itu.
>
> Jangan pernah menaruh `.env.local` di Git. Berkas itu sudah masuk `.gitignore`.

### Langkah pemasangan

1. Pasang **Node.js** versi LTS dari [nodejs.org](https://nodejs.org) — restart komputer setelahnya
2. Salin folder aplikasi ke komputer itu (tanpa tiga hal di atas)
3. Klik dua kali **`Setup Pertama Kali.bat`**, tunggu sampai selesai
4. Kalau muncul `HAMPIR SELESAI`, buka `.env.local` dengan Notepad dan isi
   `GEMINI_API_KEY=` dan `APP_PASSWORD=`
5. Klik dua kali **`Jalankan Sanghyang.bat`** — selesai

Setup butuh internet (mengunduh ±550 MB). Setelah terpasang, aplikasinya tetap
butuh internet untuk mencari berita dan memanggil Gemini, tapi tidak mengunduh
apa pun lagi.

---
---

# Catatan untuk developer

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Puppeteer · Gemini 3.5 Flash-Lite

**Cara dipakai:** dijalankan **lokal** di komputer staf lewat `Jalankan Sanghyang.bat`.
Bukan di-deploy — alasannya terukur, lihat [Kenapa aplikasi ini dijalankan LOKAL](#️-kenapa-aplikasi-ini-dijalankan-lokal-bukan-di-deploy).

### Konfigurasi

Butuh dua environment variable. Buat berkas `.env.local` di root (contoh ada di
`.env.example`):

```
GEMINI_API_KEY=xxx
APP_PASSWORD=sandi-bersama
```

`GEMINI_API_KEY` — kunci gratis di https://aistudio.google.com/apikey. Tanpa kunci
ini aplikasi tetap jalan, tapi ringkasan otomatis gagal dan UI menampilkan textarea
kosong dengan pesan "Silakan tulis manual".

`GEMINI_MODEL` — opsional, default `gemini-3.5-flash-lite`. Ada supaya modelnya bisa
diganti dari dashboard Vercel tanpa deploy ulang, karena kuota gratis tiap model
beda-beda dan angka resminya tidak bisa dipercaya. Ukur sendiri:
`npx --yes tsx scripts/test-kuota.ts <nama-model>`. Terukur di akun ini —
`gemini-2.5-flash` **20 permintaan per hari** (terlalu sedikit),
`gemini-3.5-flash-lite` 15 per menit dengan kuota terpisah.
Jangan pakai `gemini-2.5-flash-lite`: masih terdaftar tapi membalas 404.

`APP_PASSWORD` — sandi bersama untuk masuk. **Wajib diisi.** Kalau kosong, `proxy.ts`
mengunci seluruh aplikasi (semua halaman dan semua `/api/*` dijawab 503). Fail-closed
disengaja: salah setel di dashboard tidak boleh berarti pintu terbuka untuk umum.

### ⚠️ Kenapa aplikasi ini dijalankan LOKAL, bukan di-deploy

**Keputusan: dipakai lokal lewat `Jalankan Sanghyang.bat`. Vercel dibiarkan
sebagai cadangan, tidak dipakai sehari-hari.**

Alasannya diukur, bukan diperkirakan. `scripts/test-portal.ts` menguji 70 artikel
yang sama persis — daftar URL identik, kode extract identik, dijalankan berurutan
dalam satu proses — dari koneksi rumah dan dari `/api/extract` yang ter-deploy:

| | artikel terbaca | |
|---|---|---|
| **Lokal** (IP rumah) | **53/70** | **76%** |
| **Vercel** (IP datacenter) | **38/70** | **54%** |

Selisihnya 15 artikel, dan **pertukarannya searah**: 15 artikel lolos di rumah
tapi ditolak di Vercel, **0 artikel** sebaliknya. Deploy murni menurunkan
kemampuan aplikasi.

Penyebabnya bukan kode, tapi **Cloudflare menolak IP datacenter**. Sepuluh portal
menjawab 200 dengan normal dari koneksi rumah dan `HTTP 403` dari Vercel dalam
122–758 ms — ditolak di tepi jaringan sebelum menyentuh server portalnya. Sembilan
dari sepuluh memakai `server: cloudflare`:

```
ekbisbanten.com  bantenhay.com  satelitnews.com  pandeglangnews.co.id
topkonstruksi.com  kabarfajar.com  kbanews.com  ketik.com  kabar6.com
gerbangpatriot.com  <- LiteSpeed, 503, mekanisme lain
```

`ekbisbanten.com` adalah portal paling produktif di seluruh sampel — 5 artikel,
semuanya terbaca di rumah, **nol** di Vercel.

Dua catatan supaya angka ini tidak salah dipakai:

- Sampel 70 punya derau tinggi. Dua undian berbeda dari kolam yang sama
  memberi 53% dan 76% keberhasilan lokal. Yang bisa dipegang adalah **pola per
  domain** dan **selisih lokal vs Vercel dalam satu putaran** (daftar URL sama),
  bukan angka mutlaknya. Daftar sampel tersimpan di `scripts/.portal-sampel.json`
  supaya uji berikutnya bisa dibandingkan lurus.
- Diuji dari region default Vercel. Region lain belum diuji.

Sisi baiknya lokal: tidak ada batas 60 detik, tidak ada cold start, Chromium
asli untuk PDF, dan tidak ada biaya.

### Deploy ke Vercel (cadangan, tidak dipakai)

Masih berfungsi dan sudah diuji di Vercel — PDF jadi, ringkasan jalan. Jangan
dihapus; berguna kalau komputer staf bermasalah. Sadari saja ±22 poin persen
artikel yang tidak terbaca dari sana.

- `vercel.json` — region `sin1` (Singapura), `maxDuration` 60 detik (batas Hobby),
  memori 1769 MB untuk `/api/export` karena Chromium haus memori
- `/api/export` mendeteksi lingkungan lewat `process.env.VERCEL`: di Vercel memakai
  `@sparticuz/chromium` + `puppeteer-core`, di lokal memakai `puppeteer` biasa yang
  membawa Chromium sendiri
- `puppeteer` sengaja ada di **devDependencies** — kalau ikut ter-install di Vercel,
  ukuran fungsinya membengkak percuma. Set `PUPPETEER_SKIP_DOWNLOAD=true` di env
  Vercel supaya build tidak mengunduh Chromium 150 MB yang tidak dipakai

Environment variable yang harus diisi di dashboard Vercel:

| Variable | Nilai |
|---|---|
| `GEMINI_API_KEY` | kunci Gemini |
| `GEMINI_MODEL` | opsional — kosongkan untuk `gemini-3.5-flash-lite` |
| `APP_PASSWORD` | sandi bersama |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` |

**Batas Hobby yang perlu disadari:** merangkum makan 10–39 detik per artikel dan
batasnya 60 detik. Artikel panjang saat Gemini sedang lambat bisa kena timeout —
UI akan menampilkan "Gagal merangkum, silakan tulis manual", tidak crash.

### ⚠️ Risiko utama: resolver

`lib/resolver.ts` memakai endpoint **`batchexecute` milik Google News** untuk
menerjemahkan URL Google News terenkripsi menjadi URL portal asli.

**Ini API internal, bukan API resmi.** Google bisa mengubah atau mematikannya
sewaktu-waktu tanpa pemberitahuan. Kalau itu terjadi, **semua** artikel akan gagal
resolve serentak.

Fungsi `resolveOne()` disalin apa adanya dari riset yang terbukti jalan
(`spike3.mjs` baris 187). Pendekatan lain — mengikuti redirect, membaca atribut
`data-n-au`, men-decode base64 — **sudah diuji dan gagal 0/5**. Jangan ditulis ulang
tanpa riset baru.

Jalan keluarnya sudah tersedia di UI: user bisa mengisi alamat berita secara manual
lalu menekan **Ambil Ulang dari Link**, yang melewati resolver sepenuhnya.

### Struktur

```
Setup Pertama Kali.bat   dipasang sekali - cek Node, npm install, .env.local, build
Jalankan Sanghyang.bat   dipakai staf sehari-hari - npm start + buka browser
proxy.ts     penjaga sandi — Next 16 memakai nama ini, BUKAN middleware.ts
vercel.json  region sin1 + maxDuration 60 detik
/config      keywords.ts (19 query, bobot skor, blacklist) · thresholds.ts (ambang)
/lib         googlenews · filter · scoring · resolver · extractor · gemini · ui
             urlaman (penjaga SSRF) · sandi (banding waktu-aman)
/templates   newsletter.ts  ← satu sumber untuk pratinjau DAN PDF
/app/api     search (NDJSON, dialirkan) · resolve · extract · summarize · export · login
/app         page (tanggal) · review (pilih & edit) · preview (susun & unduh) · login
/scripts     skrip uji, dijalankan dengan `npx --yes tsx scripts/<nama>.ts`
```

### Skrip uji

| Skrip | Gunanya |
|---|---|
| `test-pipeline.ts` | Cari + filter + skoring, plus cek daftar validasi PRD |
| `test-resolver.ts` | Resolve 8 artikel teratas |
| `test-extractor.ts` | Ambil isi + gambar (jalankan `test-resolver.ts` dulu) |
| `test-gemini.ts` | 3 ringkasan penuh + deteksi penjiplakan verbatim |
| `test-error-paths.ts` | Portal 403, link rusak, kunci Gemini salah |
| `test-urlaman.ts` | Penjaga SSRF — alamat internal ditolak, alamat portal diterima |
| `test-export.ts` | Generate PDF lalu bongkar isinya (butuh `npm run dev` jalan) |
| `test-portal.ts` | Survei portal: berapa persen artikel terbaca, dan kenapa yang gagal itu gagal. Bisa membandingkan lokal vs Vercel (`VERCEL_APP_URL=...`). Tidak memanggil Gemini |

### Hal yang perlu diketahui

- **Tidak ada database.** State antar halaman lewat `sessionStorage`; `fullText`
  sengaja tidak ikut disimpan supaya tidak menembus kuota ~5 MB.
- **`/api/export` tidak mengirim `Content-Disposition: attachment`** — download
  manager (IDM) mencegatnya dan mengembalikan 204 kosong. Nama berkas diatur
  di sisi klien lewat atribut `download`.
- **Semua fetch sisi server wajib lewat `fetchAman()` di `lib/urlaman.ts`**, jangan
  `fetch()` langsung. Alamatnya di-resolve DNS dulu lalu nomor IP hasilnya yang
  diperiksa — memeriksa nama host saja tidak cukup, karena `localtest.me` dan
  `*.nip.io` adalah nama biasa yang resolve ke `127.0.0.1`. Redirect diikuti manual
  supaya tiap lompatan ikut diperiksa. Yang diblokir: loopback, privat, link-local
  (`169.254.169.254`), CGNAT, ULA, multicast, dan rentang cadangan.
  Sisa celah yang diketahui: DNS rebinding (alamat berubah antara pemeriksaan dan
  fetch) — lihat komentar `ponytail:` di berkasnya.
- **Gemini dipanggil paralel** kalau user mencentang beberapa artikel sekaligus.
  Free tier ±10 RPM; retry backoff sudah ada. Belum jadi masalah pada pemakaian
  1 newsletter/bulan.
- **Ringkasan Gemini disaring ulang** oleh sanitizer di `lib/gemini.ts` untuk
  membuang kalimat sisa AI seperti "This translation preserves…". Jangan dihapus.
