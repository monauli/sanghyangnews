# Sanghyang Highlights

Alat untuk membuat newsletter berita bulanan Sanghyang Resort.
Pilih bulannya, sistem mencarikan beritanya, kamu pilih dan periksa, lalu unduh PDF-nya.

Biasanya selesai dalam 5–10 menit.

---

## Cara menjalankan

1. Buka **Command Prompt** di folder ini
2. Ketik perintah berikut lalu tekan Enter:

   ```
   npm run dev
   ```

3. Tunggu sampai muncul tulisan `Ready`
4. Buka browser, masuk ke alamat:

   ```
   http://localhost:3000
   ```

Biarkan jendela Command Prompt tetap terbuka selama kamu memakai alatnya.
Kalau ditutup, alatnya berhenti.

Setelah selesai, tutup browser lalu tekan `Ctrl + C` di Command Prompt.

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

---
---

# Catatan untuk developer

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Puppeteer · Gemini 2.5 Flash

### Konfigurasi

Butuh satu environment variable. Buat berkas `.env.local` di root:

```
GEMINI_API_KEY=xxx
```

Kunci gratis bisa diambil di https://aistudio.google.com/apikey.
Tanpa kunci ini, aplikasi tetap jalan tapi ringkasan otomatis akan gagal —
UI akan menampilkan textarea kosong dengan pesan "Silakan tulis manual".

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
/config      keywords.ts (19 query, bobot skor, blacklist) · thresholds.ts (ambang)
/lib         googlenews · filter · scoring · resolver · extractor · gemini · ui
/templates   newsletter.ts  ← satu sumber untuk pratinjau DAN PDF
/app/api     search (NDJSON, dialirkan) · resolve · extract · summarize · export
/app         page (tanggal) · review (pilih & edit) · preview (susun & unduh)
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
| `test-export.ts` | Generate PDF lalu bongkar isinya (butuh `npm run dev` jalan) |

### Hal yang perlu diketahui

- **Tidak ada database.** State antar halaman lewat `sessionStorage`; `fullText`
  sengaja tidak ikut disimpan supaya tidak menembus kuota ~5 MB.
- **`/api/export` tidak mengirim `Content-Disposition: attachment`** — download
  manager (IDM) mencegatnya dan mengembalikan 204 kosong. Nama berkas diatur
  di sisi klien lewat atribut `download`.
- **`/api/extract` menolak alamat jaringan lokal** (localhost, 10.x, 192.168.x)
  supaya server tidak bisa disuruh menembak jaringan internal.
- **Gemini dipanggil paralel** kalau user mencentang beberapa artikel sekaligus.
  Free tier ±10 RPM; retry backoff sudah ada. Belum jadi masalah pada pemakaian
  1 newsletter/bulan.
- **Ringkasan Gemini disaring ulang** oleh sanitizer di `lib/gemini.ts` untuk
  membuang kalimat sisa AI seperti "This translation preserves…". Jangan dihapus.
