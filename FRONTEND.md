# FRONTEND — Sanghyang News Scraper

**Versi:** 2.0 — direvisi setelah riset teknis (spike v1–v5)
**Referensi:** `PRD.md`, `BACKEND.md` v2.0
**Stack:** Next.js App Router + TypeScript + Tailwind

> **Catatan revisi.** v1.0 ditulis sebelum riset. Perubahan utama: halaman review sekarang harus menangani **sistem skoring 3 tingkat**, **badge alasan skor**, **penanda duplikat**, dan **artikel gagal resolve/scrape**. Semua itu tidak ada di v1.0.

---

## 1. Prinsip UX

User adalah staff marketing, bukan orang teknis.

- Tidak ada istilah teknis di UI. Jangan tulis "scraping", "RSS", "resolve", "skor". Pakai bahasa manusia.
- Setiap proses lama wajib punya indikator progres
- Setiap error harus punya **jalan keluar**, bukan cuma pesan merah
- Semua hasil AI **harus bisa diedit** sebelum export

### Aturan penting soal skor

Skor itu **alat pengurut internal**. Jangan tampilkan angkanya ke user — `[18]` atau `[-12]` tidak berarti apa-apa buat staff marketing.

Yang ditampilkan: **pengelompokan** dan **badge alasan**.

## 2. Struktur Halaman

```
/app
  login/page.tsx           → Step 0: sandi bersama
  page.tsx                 → Step 1: input tanggal
  review/page.tsx          → Step 2: pilih & edit
  review/ArticleCard.tsx   → satu kartu + panel editnya
  preview/page.tsx         → Step 3: preview + download
  components/
    StepIndicator.tsx
```

**Rencana komponen di atas sengaja tidak diikuti.** `DateRangeForm`,
`LoadingProgress`, `ArticleGroup`, `ReasonBadges`, `ArticleEditor`,
`ImagePicker`, `ManualInput`, `NewsletterPreview` semuanya berakhir sebagai
belasan baris di dalam halamannya sendiri — memecahnya cuma menambah lapisan
tanpa menambah kejelasan. Yang benar-benar berdiri sendiri cuma `ArticleCard`
(dipakai berulang, punya state sendiri) dan `StepIndicator` (dipakai tiga
halaman). Terjemahan badge tinggal fungsi `badge()` di `lib/ui.ts`, bukan
komponen.

## 3. Manajemen State

Tanpa state library. `useState` + `sessionStorage`.

```ts
'sanghyang:searchResult'   → UiArticle[]
'sanghyang:selected'       → ArtikelTerpilih[]
'sanghyang:publishDate'    → string
'sanghyang:failedQueries'  → number   → banner "sebagian pencarian gagal"
'sanghyang:periode'        → "2026-07-01..2026-07-31"
```

Nama kuncinya di satu tempat: `KUNCI` di `lib/ui.ts`.

`periode` dipakai kop newsletter, dan **bukan** tanggal terbit: tanpa itu
pembaca melihat "26 Agustus 2026" di atas berita bulan Juli dan mengira
beritanya basi.

> ⚠️ `sessionStorage` hilang kalau tab ditutup. Tampilkan peringatan tetap di halaman review: *"Jangan tutup tab ini sebelum selesai download."*

Hasil pencarian bisa ~500 artikel. Simpan **hanya field yang dipakai UI** —
`UiArticle` membuang `desc` dan `query` supaya tidak kena batas ~5 MB. Gambar
hasil upload staf juga bisa melewati batas itu; kalau `setItem` gagal,
halaman review memberi pesan yang bisa ditindaklanjuti ("Gambarnya terlalu
besar…"), bukan galat mentah.

## 4. Halaman 1 — Input Tanggal (`/`)

```
┌────────────────────────────────────────────┐
│   Sanghyang Highlights                     │
│   Buat newsletter berita otomatis          │
│                                            │
│   [ Bulan Lalu ] [ Bulan Ini ] [ 30 Hari ] │
│                                            │
│   Dari    : [ 01/06/2026 ]                 │
│   Sampai  : [ 30/06/2026 ]                 │
│                                            │
│           [ Cari Berita ]                  │
└────────────────────────────────────────────┘
```

### Tombol cepat — penting

Pemakaian utamanya **bulanan**, jadi `Bulan Lalu` adalah tombol yang paling sering dipencet. Taruh paling kiri, beri gaya paling menonjol.

### Aturan
- Default saat halaman dibuka: **bulan lalu** (bukan 30 hari terakhir)
- Validasi: `dateFrom` ≤ `dateTo`, rentang maks 90 hari
- Tombol disabled selama loading

## 5. Loading State

Pencarian makan ~30 detik (19 query). Jangan biarkan layar diam.

```
⏳ Mencari berita di 19 kategori...     (7/19)
⏳ Menyaring berita yang relevan...
✅ Ditemukan 28 berita utama
```

Cukup update pesan per tahap, tidak perlu streaming.

Jangan pernah tampilkan angka mentah 669 atau 307 — itu bikin user bingung. Yang disebut cuma jumlah akhir yang relevan.

## 6. Halaman 2 — Review (`/review`)

**Halaman paling penting.** Di sinilah user mencegah error seperti yang lolos di PDF referensi.

### Layout

```
┌──────────────────────────────────────────────────┐
│ ← Kembali          Juni 2026 · 5 dipilih         │
│ ⚠️ Jangan tutup tab sebelum selesai download     │
├──────────────────────────────────────────────────┤
│ ⭐ BERITA UTAMA (28)                              │
├──────────────────────────────────────────────────┤
│ ☑ [img]  Exciting Banten Festival 2026 Hadir…    │
│          ketik.com · 26 Jun 2026 · 📍 Anyer      │
│          🏖 Wisata  🎪 Acara  ✳️ Banyak sumber   │
│          [ Lihat & Edit ▾ ]                      │
├──────────────────────────────────────────────────┤
│ ☐ [img]  Andra Soni: Anyer Harus Kembali…        │
│          Faktabanten · 28 Jun · 📍 Anyer         │
│          🏖 Wisata  ✳️ Banyak sumber             │
│          ⚠️ Mirip dengan berita #2               │
│          [ Lihat & Edit ▾ ]                      │
├──────────────────────────────────────────────────┤
│ ▸ BERITA LAIN (81)                    [ Buka ]   │
│ ▸ KURANG RELEVAN (198)                [ Buka ]   │
└──────────────────────────────────────────────────┘

              [ Buat Newsletter (5) ]
```

### Pengelompokan 3 tingkat

| Grup | Ambang | Label UI | Kondisi awal |
|---|---|---|---|
| Tinggi | skor ≥ 8 | **⭐ Berita Utama** | Terbuka |
| Sedang | skor 3–7 | **Berita Lain** | Tertutup |
| Rendah | skor < 3 | **Kurang Relevan** | Tertutup |

Jumlah realistis: **23 / 59 / 146** (Juni 2026, diukur 27 Agustus 2026).
User biasanya cukup lihat grup pertama. Ambangnya di `config/thresholds.ts`.

Ketiga grup boleh terbuka bersamaan.

### Badge alasan (`badge()` di `lib/ui.ts`)

Terjemahkan alasan teknis ke bahasa manusia:

| Internal | Tampil |
|---|---|
| `🏖wisata` | 🏖 Wisata |
| `💰investasi` | 💰 Ekonomi |
| `🎪festival` | 🎪 Acara |
| `🏛gubernur` | 🏛 Pejabat |
| `✳️7x` | ✳️ Banyak sumber |

Maksimal 3 badge per kartu. Badge bikin user paham **kenapa** artikel itu muncul — ini yang bikin mereka percaya hasilnya.

Jangan tampilkan badge negatif (`📋birokrasi`, `📰listicle`). Artikel itu sudah tenggelam sendiri ke grup bawah; menampilkan alasannya cuma bikin ramai.

### Penanda gugus berita serupa

| Kartu | Badge |
|---|---|
| Wakil gugus (skor tertinggi) | ⭐ **Paling cocok dari N berita serupa** (hijau) |
| Anggota lain | ⚠️ **1 dari N berita serupa** (amber) |

Dulu `⚠️ Mirip dengan berita #2` yang bisa diklik ke artikel asalnya. Diganti
karena dua hal:

1. `#N` memaksa staf **mencari** artikel itu — dan kalau wakilnya ada di grup
   skor lain, nomornya tidak ketemu sama sekali dan badge-nya hilang padahal
   duplikatnya terdeteksi.
2. Yang perlu diketahui staf bukan "mirip dengan siapa", tapi **"ada berapa"**.
   24 berita Krakatau yang sama cuma perlu diambil satu; itu keputusan yang bisa
   diambil tanpa mencari apa pun.

**N adalah jumlah yang TERLIHAT di grup yang sedang dibuka, bukan jumlah
se-korpus.** Gugus Krakatau berisi 24 artikel, tapi di Berita Utama cuma 9 yang
muncul. Badge yang menyebut 24 tidak bisa diverifikasi staf — mereka menghitung
9, tidak ketemu 24, lalu curiga pada seluruh aplikasi, bukan cuma pada badge
itu. Angka yang bisa dihitung sendiri lebih berharga daripada angka yang lebih
besar. (`ukuranTampak()` di `lib/ui.ts`.)

Konsekuensi yang diterima: di grup bawah bisa tidak ada ⭐ sama sekali kalau
wakilnya ada di grup atas. Itu jujur — memang tidak ada yang "paling cocok" di
antara yang terlihat di situ.

**Jangan auto-buang.** Berita yang sama dari portal berbeda kadang versinya
lebih bagus. User yang putuskan.

### Alur pemilihan

- Checkbox **default kosong semua** — user memilih sadar
- Saat dicentang → jalankan resolve + extract + summary untuk artikel itu saja
- Tampilkan spinner kecil di kartu: `Mengambil isi…` → `Merangkum…` → summary muncul
- Ini hemat: dari ~230 artikel yang lolos, cuma 5 yang diproses
- Membatalkan centang **tidak** membuang hasil kerjanya — centang ulang jadi instan
- Panggilan Gemini dijaga `lib/antre.ts`: 2 slot + jeda 4,2 detik antar-mulai (~14/menit)

### Panel Edit (accordion)

| Field | Kontrol |
|---|---|
| Ringkasan | Textarea + hitungan kata |
| Gambar | Preview + tombol Ganti (upload) / Hapus |
| Link sumber | Di balik tombol `Ubah link` |
| Judul | Di balik tombol `Ubah judul` |
| — | Tombol `Buat Ulang Ringkasan` |

**Beberapa panel boleh terbuka bersamaan.** Dulu membuka yang berikutnya
menutup yang sebelumnya — editor yang membandingkan dua ringkasan mengira
aplikasinya rusak.

**Judul dan link sembunyi di balik tombol, bukan selalu terlihat.** Keduanya
jalan keluar, bukan pekerjaan rutin: `judulBersih()` sudah membereskan
mayoritas judul, tapi selalu ada yang lolos dan staf harus punya jalan keluar
yang tidak butuh developer. Yang diketik staf selalu menang atas hasil otomatis.

**Hitungan kata itu saran, bukan aturan.** Targetnya dihitung proporsional
terhadap panjang sumber (`targetKata()` di `lib/gemini.ts`), jadi angkanya beda
tiap artikel. Tampilannya:

```
169 kata · pas 160-180                  → abu-abu
147 kata · pas 109-136 · agak panjang   → amber
```

Tombol `Buat Newsletter` **tetap aktif**. Yang membingungkan bukan angkanya,
tapi diamnya: dulu angka ditampilkan tanpa reaksi apa pun, jadi staf tidak tahu
apakah 200 kata itu masalah. Menyembunyikan angkanya menghilangkan sinyal yang
sah; memberi reaksi halus menjawab pertanyaannya tanpa menghalangi.

### Penanganan error — WAJIB ADA

Ini bagian yang tidak ada di v1.0. Berdasarkan hasil uji, sebagian portal memang bermasalah.

| Kondisi | Tampilan | Jalan keluar |
|---|---|---|
| Resolve gagal | 🟡 "Link belum bisa dipastikan" | Input URL manual |
| Scrape 403 (`lifestyle.bisnis.com`) | 🟡 "Situs ini tidak bisa dibaca otomatis" | Textarea tempel teks manual |
| Timeout (`infoekonomi.id`) | 🟡 "Gagal memuat" | Tombol Coba Lagi |
| Gambar gagal / resolusi rendah | Placeholder | Tombol Upload gambar |
| Summary gagal / kena limit | Textarea kosong | Kalimat kuota yang aman dibaca staf — **jangan pernah menampilkan kode 500 atau istilah teknis** |
| Artikel terbagi beberapa halaman | ⚠️ badge + keterangan di panel | Tempel sisa teksnya manual |
| Ringkasan menyalin sumber | Tombol lanjut dikunci + penjelasan | Tulis ulang dengan kalimat sendiri |

**Prinsip: artikel gagal tetap ditampilkan, jangan disembunyikan.** User mungkin tetap mau memakainya dengan input manual.

### Validasi sebelum lanjut

Tombol "Buat Newsletter" disabled kalau:
- Tidak ada artikel dipilih
- Ada artikel terpilih yang **masih diproses**
- Ada artikel terpilih tanpa ringkasan
- Ada artikel terpilih tanpa URL valid
- Ada ringkasan yang **menyalin sumbernya** (`lib/jiplak.ts`) — itu hak cipta portal

Yang menentukan siap adalah **isi**-nya, bukan tahap prosesnya. Sempat sebaliknya,
dan artikel yang gagal extract berhenti di tahap 'kosong' selamanya — staf yang
sudah menempel isi dan menulis ringkasan sendiri tetap dibilang "belum siap",
jadi jalur penyelamatan untuk portal pemblokir bot percuma.

## 7. Halaman 3 — Preview (`/preview`)

```
┌────────────────────────────────────────┐
│ ← Kembali ke Review                    │
│                                        │
│ Tanggal terbit: [ 26/06/2026 ]         │
│ Urutan artikel: [ drag untuk atur ]    │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │  Preview newsletter (HTML)         │ │
│ │  tampil persis seperti PDF         │ │
│ └────────────────────────────────────┘ │
│                                        │
│         [ Download PDF ]               │
└────────────────────────────────────────┘
```

### Aturan
- Preview memakai **template HTML yang sama persis** dengan Puppeteer — WYSIWYG
- Tanggal terbit bisa diubah, default hari ini
- **Format tanggal Bahasa Indonesia:** `Jumat, 26 Juni 2026`
- Nama file: `Sanghyang_Highlights_2026-06-26.pdf`
- Saat generate: loading di tombol saja, jangan blokir halaman

## 8. Komponen

Cuma dua yang benar-benar jadi berkas sendiri — lihat catatan di §2.

### `StepIndicator`
```
①  Pilih Tanggal  →  ②  Review Berita  →  ③  Download
```

### `ArticleCard`
```ts
{ artikel, nomor, wakilGugus, ukuranTampak, dipilih, terbuka, kerja,
  onToggle, onBuka, onUbah, onUlangi, onAmbilUlang, onBuatUlangRingkasan }
```
Thumbnail, judul, sumber, tanggal, badge alasan, badge gugus, peringatan
extract, status error, dan panel editnya. `kerja` (tipe `Kerja`) memuat seluruh
hasil resolve/extract/summarize plus suntingan staf.

Sisanya — pengelompokan skor, input manual URL/teks, pemilih gambar — tinggal
di dalam `ArticleCard` atau halamannya: masing-masing belasan baris, tidak ada
yang dipakai di dua tempat.

## 9. Styling

Ikuti identitas visual PDF referensi.

| Elemen | Nilai |
|---|---|
| Warna utama | Hijau tua |
| Warna aksen | Hijau muda |
| Font judul | Sans-serif bold |
| Font body | Sans-serif regular |
| Latar | Putih bersih |

Tailwind saja. Hindari component library berat.

## 10. Responsif

Prioritas **desktop** — ini alat kerja kantor. Tablet diusahakan layak. Mobile bukan prioritas v1.

## 11. Yang TIDAK dibuat di v1

- ~~❌ Login~~ → **ada**: satu sandi bersama (`APP_PASSWORD`), dijaga `proxy.ts`.
  Ditambahkan waktu aplikasi masih di Vercel dan tetap dipakai walau sekarang
  jalan lokal.
- ❌ Arsip / riwayat newsletter
- ❌ Edit keyword dari UI (edit `config/keywords.ts`)
- ❌ Dark mode
- ❌ Toggle Bahasa Inggris
- ❌ Menampilkan angka skor mentah ke user
