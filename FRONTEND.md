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
  page.tsx                 → Step 1: input tanggal
  review/page.tsx          → Step 2: pilih & edit
  preview/page.tsx         → Step 3: preview + download
  components/
    StepIndicator.tsx
    DateRangeForm.tsx
    LoadingProgress.tsx
    ArticleGroup.tsx       ← BARU: pengelompokan skor
    ArticleCard.tsx
    ReasonBadges.tsx       ← BARU: badge alasan
    ArticleEditor.tsx
    ImagePicker.tsx
    ManualInput.tsx        ← BARU: fallback artikel gagal
    NewsletterPreview.tsx
```

## 3. Manajemen State

Tanpa state library. `useState` + `sessionStorage`.

```ts
'sanghyang:searchResult'   → ScoredArticle[]
'sanghyang:selected'       → FullArticle[]
'sanghyang:publishDate'    → string
```

> ⚠️ `sessionStorage` hilang kalau tab ditutup. Tampilkan peringatan tetap di halaman review: *"Jangan tutup tab ini sebelum selesai download."*

Hasil pencarian bisa ~300 artikel. Simpan **hanya field yang dipakai UI** — buang `desc` dan `fullText` dari sessionStorage supaya tidak kena batas ~5MB.

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

Jumlah realistis: 28 / 81 / 198. User biasanya cukup lihat grup pertama.

### Badge alasan (`ReasonBadges.tsx`)

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

### Penanda duplikat

Badge `⚠️ Mirip dengan berita #2`, bisa diklik untuk scroll ke artikel asalnya.

**Jangan auto-buang.** Berita yang sama dari portal berbeda kadang versinya lebih bagus. User yang putuskan.

### Alur pemilihan

- Checkbox **default kosong semua** — user memilih sadar
- Saat dicentang → jalankan resolve + extract + summary untuk artikel itu saja
- Tampilkan spinner kecil di kartu: `Mengambil isi…` → `Merangkum…` → summary muncul
- Ini hemat: dari 307 artikel, cuma 5 yang diproses

### Panel Edit (accordion)

| Field | Kontrol |
|---|---|
| Judul | Input teks |
| Ringkasan | Textarea + hitungan kata (target 120–180) |
| Gambar | Preview + tombol Ganti (upload) / Hapus |
| Link sumber | Input teks, bisa dikoreksi manual |
| — | Tombol `Buat Ulang Ringkasan` |

### Penanganan error — WAJIB ADA

Ini bagian yang tidak ada di v1.0. Berdasarkan hasil uji, sebagian portal memang bermasalah.

| Kondisi | Tampilan | Jalan keluar |
|---|---|---|
| Resolve gagal | 🟡 "Link belum bisa dipastikan" | Input URL manual |
| Scrape 403 (`lifestyle.bisnis.com`) | 🟡 "Situs ini tidak bisa dibaca otomatis" | Textarea tempel teks manual |
| Timeout (`infoekonomi.id`) | 🟡 "Gagal memuat" | Tombol Coba Lagi |
| Gambar gagal / < 300px | Placeholder | Tombol Upload gambar |
| Summary gagal / kena limit | Textarea kosong | Pesan "Silakan tulis manual" |

**Prinsip: artikel gagal tetap ditampilkan, jangan disembunyikan.** User mungkin tetap mau memakainya dengan input manual.

### Validasi sebelum lanjut

Tombol "Buat Newsletter" disabled kalau:
- Tidak ada artikel dipilih
- Ada artikel terpilih tanpa ringkasan
- Ada artikel terpilih tanpa URL valid

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

### `StepIndicator`
```
①  Pilih Tanggal  →  ②  Review Berita  →  ③  Download
```

### `ArticleGroup`
Props: `title`, `count`, `articles`, `defaultOpen`, `onToggleSelect`
Accordion pembungkus satu tingkat skor.

### `ArticleCard`
Props: `article`, `selected`, `onToggle`, `onEdit`
Thumbnail, judul, sumber, tanggal, lokasi, badge, penanda duplikat, status error.

### `ManualInput`
Muncul saat resolve/scrape gagal. Dua mode: input URL, atau tempel teks artikel.

### `ImagePicker`
Preview + upload (JPG/PNG, maks 5MB) → konversi base64 untuk `/api/export`.

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

- ❌ Login
- ❌ Arsip / riwayat newsletter
- ❌ Edit keyword dari UI (edit `config/keywords.ts`)
- ❌ Dark mode
- ❌ Toggle Bahasa Inggris
- ❌ Menampilkan angka skor mentah ke user
