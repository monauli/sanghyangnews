# BACKEND — Sanghyang News Scraper

**Versi:** 2.0 — direvisi setelah riset teknis (spike v1–v5)
**Referensi:** `PRD.md`
**Stack:** Next.js API Routes (App Router) + TypeScript

> **Catatan revisi.** Versi 1.0 ditulis sebelum riset teknis. Bagian resolver di v1.0 **terbukti salah total (0/5 berhasil)** dan sudah diganti. Semua angka di dokumen ini berasal dari pengujian nyata, bukan perkiraan.

---

## 1. Ringkasan Hasil Riset

| Temuan | Status | Bukti |
|---|---|---|
| Google News RSS bisa diakses, filter tanggal jalan | ✅ | 40 artikel untuk 1 query |
| Resolver follow-redirect / base64 | ❌ **GAGAL** | 0/5 |
| Resolver `batchexecute` | ✅ **BERHASIL** | 10/10, 0.56 detik/artikel |
| Scraping portal (teks + gambar) | ✅ | 8/10 portal |
| Query lokasi tunggal untuk wilayah besar | ❌ mentok batas 100 | Serang/Cilegon/Banten = 100 persis |
| Query lokasi × topik | ✅ | 0/19 query mentok |
| Filter topik keras | ❌ terlalu kasar | Listicle SEO ikut lolos |
| Sistem skoring | ✅ | 20 teratas relevan semua |

**Volume nyata (7 lokasi × 1 bulan):** 669 mentah → 441 unik → 307 lolos filter → **28 skor tinggi**.

## 2. Struktur Folder

```
/app
  /api
    /search/route.ts       → cari + filter + skoring
    /resolve/route.ts      → resolve URL terpilih
    /extract/route.ts      → ambil isi artikel + gambar
    /summarize/route.ts    → generate summary (Gemini)
    /export/route.ts       → generate PDF
/lib
  googlenews.ts            → build query + fetch + parse RSS
  resolver.ts              → batchexecute (KRITIS — lihat §5)
  filter.ts                → blacklist, lokasi, dedupe
  scoring.ts               → pembobotan tema
  extractor.ts             → full text + og:image
  gemini.ts                → wrapper + sanitizer
  pdf.ts                   → HTML → PDF
/config
  keywords.ts              → semua daftar kata & bobot
/templates
  newsletter.html
/types
  index.ts
```

## 3. Tipe Data

```ts
type RawArticle = {
  title: string;
  link: string;          // URL Google News (terenkripsi)
  pubDate: string;
  desc: string;
  sourceName: string;
  query: string;         // query yang menemukannya
};

type ScoredArticle = RawArticle & {
  id: string;            // dari segmen link Google
  location: string;      // "cilegon"
  score: number;
  reasons: string[];     // ["🏖wisata", "💰investasi"]
  hits: number;          // ditemukan di berapa query
  dupeOf: number | null; // index artikel mirip
};

type FullArticle = ScoredArticle & {
  finalUrl: string | null;
  fullText: string | null;
  imageUrl: string | null;
  summary: string | null;
  errors: string[];
};
```

## 4. Modul: Google News (`lib/googlenews.ts`)

### Strategi Query — 19 query

Lokasi kecil di-query sendiri. Lokasi besar **wajib** dipasangkan topik, kalau tidak hasilnya mentok di batas 100 artikel Google dan penuh berita generik (pencurian, rapat DPRD, mutasi pegawai).

```ts
const LOC_KECIL = ['Anyer', 'Carita', 'Cinangka', 'Cikoneng'];
const LOC_BESAR = ['Serang', 'Cilegon', 'Banten'];
const TOPIK_QUERY = ['wisata', 'hotel resort', 'investasi', 'pariwisata', 'festival'];

// 4 + (3 × 5) = 19 query
```

### URL Format
```
https://news.google.com/rss/search
  ?q={QUERY}+after:{YYYY-MM-DD}+before:{YYYY-MM-DD}
  &hl=id&gl=ID&ceid=ID:id
```

### Catatan
- `before:` **eksklusif** → user pilih sampai 30 Juni, kirim `before:2026-07-01`
- Jeda ~200ms antar query
- `Promise.allSettled` — satu query gagal tidak menggagalkan semuanya
- **`pubDate` jamnya tidak akurat** — Google menormalisasi semua ke `07:00:00 GMT`. Tanggalnya valid, jamnya jangan dipakai.
- Parsing RSS cukup manual (split `<item>` + regex). Tidak perlu library.

## 5. Modul: Resolver (`lib/resolver.ts`) — KRITIS

🔴 **Jangan tulis ulang dari nol. Salin dari `spike5.mjs` fungsi `resolveOne()`.**

### Kenapa strategi lama gagal

URL Google News berbentuk hybrid: awalannya `CBM` (format lama), tapi isinya payload `AU_yqL...` yang **terenkripsi**. Akibatnya:

| Strategi | Hasil |
|---|---|
| Follow redirect | ❌ tetap di `news.google.com` |
| Parse `data-n-au` di HTML | ❌ atribut tidak ada |
| Decode base64 | ❌ isinya terenkripsi |

### Cara yang berhasil

```
1. GET halaman artikel Google News
2. Ambil dari HTML: data-n-a-sg (signature) & data-n-a-ts (timestamp)
3. POST ke https://news.google.com/_/DotsSplashUi/data/batchexecute
   body: f.req = [[["Fbv4je", "[\"garturlreq\", ...]", null, "generic"]]]
   payload memuat: id artikel, timestamp, signature
4. Regex response untuk URL non-google
```

Terbukti **10/10 berhasil, 0.56 detik per artikel**.

### Aturan
- Resolve **hanya artikel yang dipilih user**, bukan semua 307
- Sekuensial dengan jeda 300ms — cukup cepat, tidak perlu paralel
- Timeout 12 detik
- Cache per session

### ⚠️ Risiko yang harus disadari
`batchexecute` adalah **API internal Google, bukan API resmi**. Bisa berubah sewaktu-waktu tanpa pemberitahuan.

**Wajib ada fallback:** jika resolver gagal, tampilkan artikel dengan flag warning dan sediakan input URL manual. Newsletter tidak boleh mati total hanya karena Google ganti format.

## 6. Modul: Filter (`lib/filter.ts`)

Berjalan lokal. Gratis, instan.

### Yang dibuang beneran

**1. Blacklist** — cek di `title + desc`:
```
Olahraga/hiburan : sepak bola, liga, persita, artis, gosip
Musibah          : tewas, meninggal, tenggelam, terseret, korban,
                   jenazah, hilang, kebakaran, banjir, longsor, gempa
Kriminal         : begal, narkoba, pencurian, penipuan, curanmor,
                   razia, ditangkap, tersangka, korupsi, penganiayaan
Politik praktis  : pilkada, pemilu, kampanye, partai
```

**2. Lokasi wajib ada di JUDUL** — bukan hanya di isi.
Aturan ini membuang berita seperti *"RW08 Kelurahan Depok ajak wisata ke Anyer"* — secara teknis menyebut Anyer, tapi tidak relevan untuk newsletter hotel. Terbukti membuang 114 artikel, semuanya memang tidak relevan.

### Yang TIDAK dibuang

**Filter topik keras dihapus.** Diganti sistem skoring (§7). Alasan: filter keras melolosan listicle SEO yang secara teknis memang membahas wisata.

**Duplikat ditandai, bukan dibuang.** Bandingkan kemiripan kata judul (ambang 0.55). Beri `dupeOf` untuk ditampilkan sebagai badge `⚠️ mirip #2`. User yang memutuskan.

Dedupe antar query tetap dilakukan berdasarkan id link — sekitar 34% artikel muncul di lebih dari satu query.

## 7. Modul: Skoring (`lib/scoring.ts`)

**Prinsip: yang menentukan relevansi adalah TEMA, bukan ada-tidaknya pejabat.**

Percobaan sebelumnya memberi nilai positif ke kata pemerintahan (`pemkot`, `DPRD`, `perda`). Hasilnya newsletter penuh berita "Raperda Pertanggungjawaban APBD" dan "Mutasi Sekwan" — tidak ada nilainya untuk hotel.

### Bobot

| Kategori | Nilai | Contoh kata |
|---|---|---|
| 🏖 Wisata inti | **+5** (maks ×2) | wisata, pariwisata, destinasi, resort, hotel, penginapan, kuliner, pantai, okupansi |
| 💰 Ekonomi & infrastruktur | **+3** (maks ×2) | investasi, PSN, infrastruktur, tol, pelabuhan, pembangunan, industri, pabrik, UMKM |
| 🎪 Acara | **+3** | festival, event, pameran, expo, pesta laut, karnaval |
| 🏛 Pejabat | **+2** | gubernur, menteri, bupati, walikota, peresmian, kerja sama |
| 📋 **Birokrasi internal** | **−6** | raperda, APBD, pertanggungjawaban, mutasi, sekwan, BPK, monev, paripurna, banggar, reses, pansus, ASN |
| 📰 Listicle SEO | **−4** per kata | tak perlu, hidden gem, estetik, ramah kantong, weekend escape, wajib dikunjungi, rekomendasi, bosan |
| 🔢 Judul diawali angka | **−5** | "5 Tempat Wisata Terbaik…" |
| ❗ Ada `!` atau `?` | **−3** | clickbait |
| ✳️ Ditemukan di banyak query | **+2** | tanda berita penting |

Daftar lengkap ada di `spike5.mjs` (konstanta `W_WISATA`, `W_EKONOMI`, `W_ACARA`, `W_PEJABAT`, `W_BIROKRASI`, `LISTICLE`). Salin apa adanya.

### Pengelompokan

| Skor | Label | Perlakuan di UI |
|---|---|---|
| ≥ 8 | 🟢 Tinggi | Tampil default |
| 3–7 | 🟡 Sedang | Tampil di bawah |
| < 3 | ⚪ Rendah | Sembunyikan, buka via "Tampilkan semua" |

Hasil uji: 28 tinggi · 81 sedang · 198 rendah. Untuk newsletter yang butuh 4–5 artikel, 28 sudah lebih dari cukup.

## 8. Modul: Extractor (`lib/extractor.ts`)

Dipanggil **hanya untuk artikel yang dipilih user**.

### Header wajib

Request polos ditolak sebagian portal. Pakai header lengkap:

```ts
{
  'User-Agent': '<Chrome UA>',
  'Accept': 'text/html,application/xhtml+xml,...',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  'Referer': 'https://www.google.com/',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
}
```

**Retry 2 tahap:** kalau gagal, coba ulang tanpa `Referer` dan `Sec-Fetch-Site` — sebagian portal menolak referer eksternal.

### Yang diambil
| Data | Cara |
|---|---|
| Full text | `@extractus/article-extractor` atau Readability + jsdom |
| Gambar | `og:image` → fallback `twitter:image` |
| Judul | `og:title` → fallback `<h1>` |

Teks < 1500 karakter = kemungkinan butuh JS render → tandai bermasalah.

### Portal yang diketahui bermasalah
| Portal | Masalah |
|---|---|
| `lifestyle.bisnis.com` | 403 permanen, retry tidak menolong |
| `infoekonomi.id` | timeout tidak konsisten |

Jangan dipaksa. Tampilkan opsi input manual.

## 9. Modul: Gemini (`lib/gemini.ts`)

**Model:** `gemini-2.5-flash` · **SDK:** `@google/genai` · **Env:** `GEMINI_API_KEY`

> ⚠️ Bagian ini **belum diuji**. Sepanjang riset, Gemini belum pernah dipanggil. Kualitas ringkasan baru ketahuan saat implementasi.

### Prompt

```
Kamu adalah editor newsletter internal Sanghyang Resort (Anyer, Banten).

Ringkas artikel berita berikut untuk newsletter internal.

ATURAN KERAS:
1. Tulis ulang dengan kalimatmu sendiri. DILARANG menyalin kalimat
   utuh dari artikel asli.
2. Panjang: 3-4 paragraf pendek, total 120-180 kata.
3. Bahasa Indonesia formal-jurnalistik. Netral, tanpa opini.
4. Pertahankan fakta penting: nama orang, jabatan, angka, tanggal,
   nama tempat, nama institusi.
5. Kutipan langsung boleh MAKSIMAL satu kalimat pendek.
6. JANGAN tulis pengantar, penutup, atau komentar tentang hasil
   ringkasanmu. Keluarkan HANYA teks ringkasan.
7. Pastikan ejaan nama institusi benar
   (contoh: "Satuan Polisi Pamong Praja (Satpol PP)").

JUDUL: {title}
SUMBER: {sourceName}
ARTIKEL:
{fullText}
```

### Sanitizer — WAJIB

Aturan 6 saja tidak cukup. Setelah dapat response, buang baris yang mengandung:
```
translation preserves, ringkasan ini, berikut adalah,
semoga membantu, sebagai editor, artikel di atas
```

**Alasan:** PDF referensi klien bocor kalimat *"This translation preserves the original meaning while maintaining a neutral, professional tone appropriate for news reporting"* ke publikasi. Sanitizer adalah lapisan pengaman kedua.

### Batasan
- `fullText` dipotong maksimal 8.000 karakter
- Retry 2× exponential backoff saat `429`
- Panggil **sekuensial**, bukan paralel — hormati limit RPM free tier
- Volume normal: ~5 call per newsletter, jauh di bawah kuota

## 10. Modul: PDF (`lib/pdf.ts`)

Puppeteer → render `templates/newsletter.html` → PDF.

```ts
{ format: 'A4', printBackground: true, margin: { top:'0', right:'0', bottom:'0', left:'0' } }
```

### Wajib
- Gambar di-embed **base64**, bukan URL eksternal
- Font embed lokal, jangan andalkan Google Fonts
- **Format tanggal konsisten Bahasa Indonesia:** `Jumat, 26 Juni 2026`
  PDF referensi menulis "Kamis, 25 June 2026" — campur bahasa, jangan diulang.
- Penulisan brand konsisten: pilih **Mövenpick** (dengan umlaut), jangan campur

### Template
Header (tanggal + Sanghyangresort) · Judul "Sanghyang Highlights" · artikel selang-seling gambar kiri/kanan · footer `www.sanghyang.com` · maks 2 artikel per halaman.

## 11. API Routes

### `POST /api/search`
```ts
// Request
{ dateFrom: "2026-06-01", dateTo: "2026-06-30" }

// Response
{
  articles: ScoredArticle[],   // terurut skor, BELUM di-resolve
  stats: { raw: 669, unique: 441, filtered: 307,
           high: 28, medium: 81, low: 198, failedQueries: 0 }
}
```

### `POST /api/resolve`
```ts
{ ids: string[] } → { results: Array<{ id, finalUrl, error? }> }
```

### `POST /api/extract`
```ts
{ urls: string[] } → { results: Array<{ url, fullText, imageUrl, error? }> }
```

### `POST /api/summarize`
```ts
{ articles: Array<{ title, fullText, sourceName }> }
  → { summaries: Array<{ summary, error? }> }
```

### `POST /api/export`
```ts
{ publishDate, articles: Array<{ title, summary, imageBase64, url, sourceName }> }
  → Binary PDF
```

## 12. Environment

```env
GEMINI_API_KEY=xxx
```

Hanya satu variable. Tidak ada database, tidak ada auth di v1.

## 13. Error Handling

**Prinsip: jangan pernah gagal total.**

| Kondisi | Perilaku |
|---|---|
| Satu query RSS gagal | Lanjut dengan sisanya, catat di `stats.failedQueries` |
| Resolver gagal | Tampilkan artikel + flag warning + input URL manual |
| Extract gagal / 403 | Tawarkan input teks manual |
| Gemini error / limit | Kembalikan tanpa summary, user tulis sendiri |
| Puppeteer gagal | Error jelas + tombol coba lagi |

## 14. Catatan Performa (terukur)

| Tahap | Waktu |
|---|---|
| 19 query RSS | ~25 detik |
| Filter + skoring | < 1 detik (lokal) |
| Resolve per artikel | 0.56 detik |
| Extract per artikel | 1–3 detik |
| Summary per artikel | **9–39 detik (terukur)** |

**Total realistis:** cari ~10-30 detik, proses 5 artikel terpilih **~1-2 menit**.

> ⚠️ **Revisi setelah uji Gemini.** Perkiraan awal 2-5 detik per summary meleset jauh:
> pengukuran nyata 9-39 detik (gemini-2.5-flash, artikel 121-505 kata). Untuk 5 artikel
> berarti **1-2 menit, bukan 30 detik**.
>
> Implikasi untuk indikator progres (FRONTEND.md §5): tahap merangkum tidak boleh
> memakai satu spinner diam. Wajib progres per artikel ("Merangkum berita 3 dari 5…"),
> kalau tidak user akan mengira aplikasinya menggantung.
