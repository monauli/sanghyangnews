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
    /login/route.ts        → tukar sandi jadi cookie sesi
proxy.ts                   → penjaga sandi (dulu middleware.ts, sudah usang)
/lib
  googlenews.ts            → build query + fetch + parse RSS
  resolver.ts              → batchexecute (KRITIS — lihat §5)
  judul.ts                 → judulBersih(): kupas ekor " - NamaSumber"
  filter.ts                → blacklist, lokasi, dedupe, gugus berita serupa
  scoring.ts               → pembobotan tema + pilih wakil gugus
  extractor.ts             → full text + og:image + deteksi artikel berhalaman
  gemini.ts                → wrapper + sanitizer
  jiplak.ts                → cek ringkasan tidak menyalin sumber
  urlaman.ts               → tolak URL ke jaringan lokal (SSRF)
  sandi.ts                 → banding sandi tahan timing attack
  antre.ts                 → batasi laju panggilan Gemini di sisi browser
  ui.ts                    → bentuk data untuk halaman + badge + tanggal
/config
  keywords.ts              → semua daftar kata & bobot
  thresholds.ts            → ambang skor & ambang kemiripan
/templates
  newsletter.ts
```

`/types` tidak ada — tiap modul mengekspor tipenya sendiri.

## 3. Tipe Data

```ts
type RawArticle = {
  title: string;
  link: string;          // URL Google News (terenkripsi)
  pubDate: string;
  desc: string;
  sourceName: string;
  sourceUrl: string;     // atribut url pada <source> — dipakai cek portal iklan
  query: string;         // query yang menemukannya
};

type FilteredArticle = RawArticle & {
  id: string;            // dari segmen link Google
  judul: string;         // title tanpa ekor nama media — lihat §6
  location: string;      // "cilegon"
  hits: number;          // ditemukan di berapa query
  dupeOf: string | null; // ID WAKIL gugus, bukan index; null = dia wakilnya
  grupUkuran: number;    // banyak artikel dalam gugus, termasuk dirinya
};

type ScoredArticle = FilteredArticle & {
  score: number;
  reasons: string[];     // ["🏖wisata", "💰investasi"]
};
```

`dupeOf` dulu `number` (index array). Diganti ID karena `scoreArticles()`
mengurutkan ulang array — index-nya jadi menunjuk artikel yang salah.

Tidak ada `FullArticle`. Hasil resolve/extract/summarize tinggal di state
halaman review (`Kerja` di `app/review/ArticleCard.tsx`), tidak pernah digabung
balik ke artikel: yang perlu disimpan cuma untuk artikel terpilih, dan bentuknya
berubah tiap kali user mengedit.

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

🔴 **Jangan tulis ulang dari nol.** Sudah ada di `lib/resolver.ts`, disalin dari `spike3.mjs` fungsi `resolveOne()`.

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
Aturan ini membuang berita seperti *"RW08 Kelurahan Depok ajak wisata ke Anyer"* — secara teknis menyebut Anyer, tapi tidak relevan untuk newsletter hotel. Terukur membuang ~195 artikel per bulan, semuanya memang tidak relevan.

**Judul yang dibandingkan WAJIB sudah bersih.** Judul RSS Google selalu
berakhiran `" - NamaSumber"`, kadang dua kali kalau portalnya menempel nama
sendiri lebih dulu. `filterArticles()` membersihkannya sekali di awal dengan
`judulBersih()` (`lib/judul.ts`) dan menyimpannya di field `judul`; semua tahap
sesudahnya — blacklist, regional, lokasi, kemiripan, skoring — membaca field
itu, bukan `title` mentah. Tanpa ini artikel yang sama lolos atau dibuang
tergantung siapa yang memberitakan: *"Israel Kembali Serang Gaza - Radar
Banten"* lolos saringan lokasi karena kata "banten" ada di nama medianya.

**3. "Serang" butuh konteks Banten.** Satu-satunya kata lokasi yang juga kata
kerja bahasa Indonesia. Kata "serang" saja tidak meloloskan artikel — harus ada
penguat di judul atau ringkasannya: nama tempat Banten lain, jabatan atau satuan
administratif (`Bupati Serang`, `Pemkab Serang`, `Polres Serang`,
`Dinas … Serang`), ruas tol `Serang–Panimbang`, atau bentuk `"di Serang"`.
Daftarnya `PENGUAT_SERANG` di `config/keywords.ts` — isinya **sumber regex,
bukan teks polos**. Menambah nama kota luar ke blacklist tidak akan pernah
selesai; yang disyaratkan konteksnya, bukan daftar larangan.

### Yang TIDAK dibuang

**Filter topik keras dihapus.** Diganti sistem skoring (§7). Alasan: filter keras melolosan listicle SEO yang secara teknis memang membahas wisata.

**Duplikat ditandai, bukan dibuang.** Bandingkan kemiripan kata judul (Jaccard,
ambang `DUPE_THRESHOLD` = 0.45 di `config/thresholds.ts`). User yang memutuskan.

Pengelompokannya **union-find**, bukan rantai. Dulu tiap artikel berhenti di
pasangan pertama yang cocok; pada peristiwa besar (24 berita Krakatau dari 24
media) hasilnya rantai panjang, bukan satu gugus, dan staf melihat beberapa
tanda terpencar tanpa pernah tahu ada dua puluh empat berita yang sama. Sekarang
semua yang saling mirip masuk satu gugus walau A dan C tidak langsung mirip,
asal sama-sama mirip B.

`filterArticles()` mengisi `dupeOf` dengan ID akar gugus sebagai penanda
sementara. Wakil sebenarnya ditentukan `scoreArticles()` (§7) — pemilihannya
butuh skor.

Ambang 0.45 dipilih dari pengukuran, bukan tebakan: 0.55 → 5 pasang, 0.50 → 14,
0.45 → 15 (0 positif palsu), 0.40 → 18 tapi mulai menggabung sudut berita yang
memang berbeda.

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

Daftar lengkap ada di `config/keywords.ts` (`W_WISATA`, `W_EKONOMI`, `W_ACARA`,
`W_PEJABAT`, `W_BIROKRASI`, `LISTICLE`), disalin apa adanya dari `spike5.mjs`.

Semua pembacaan judul memakai `it.judul`, bukan `it.title` mentah — kalau tidak,
media bernama "Banten Wisata" menyumbang +5 🏖 ke berita yang tidak bicara wisata.

### Wakil gugus berita serupa

`scoreArticles()` mengganti akar sementara dari §6 dengan **wakil sebenarnya**:
anggota berskor tertinggi, karena itu yang paling mungkin dipakai staf. `dupeOf`
wakilnya jadi `null` supaya kartunya bisa ditandai berbeda.

### Pengelompokan

| Skor | Label | Perlakuan di UI |
|---|---|---|
| ≥ 8 | 🟢 Tinggi | Tampil default |
| 3–7 | 🟡 Sedang | Tampil di bawah |
| < 3 | ⚪ Rendah | Sembunyikan, buka via "Tampilkan semua" |

Ambangnya di `config/thresholds.ts` (`SCORE_TINGGI` = 8, `SCORE_SEDANG` = 3).

Hasil uji Juni 2026 (diukur 27 Agustus 2026): 23 tinggi · 59 sedang · 146 rendah.
Untuk newsletter yang butuh 4–5 artikel, 23 sudah lebih dari cukup. Angkanya
bergerak antar pemanggilan — lihat catatan non-determinisme di `PRD.md` §13.

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

### Peringatan yang dikembalikan (`warnings`)

| Kode | Arti | Ditampilkan sebagai |
|---|---|---|
| `artikel-pendek` | teks sumber < 180 kata | ⚠️ Sumber terbatas |
| `gambar-kecil` | og:image di bawah ambang | ⚠️ Gambar resolusi rendah |
| `berhalaman` | ada tautan `?page=2` / `/2` ke **artikel yang sama** | ⚠️ Terbagi beberapa halaman |

`berhalaman` yang paling penting: artikel berhalaman **tidak terlihat sebagai
kegagalan** — teksnya masuk, ringkasannya jadi, tapi isinya cuma halaman satu.
Terukur 6 dari 59 artikel (10%).

Penandanya sengaja bukan `rel="next"`, `class="pagination"`, atau `aria-label`
yang memuat "page": ketiganya diuji dan **salah semua** — di portal nyata
`rel="next"` menunjuk artikel LAIN, dan `pagination` adalah nama modul tema.
Yang dipakai: tautan yang alamatnya **sama persis dengan artikel ini** ditambah
nomor halaman ≥ 2. Uji: `scripts/test-berhalaman.ts`.

Mengambil semua halaman otomatis **sengaja tidak dikerjakan**: risiko teks
sampah ("Baca Juga", navigasi) ikut masuk ke Gemini lebih mahal daripada 10%
artikel yang perlu diselamatkan manual.

### Portal yang diketahui bermasalah
| Portal | Masalah |
|---|---|
| `lifestyle.bisnis.com` | 403 permanen, retry tidak menolong |
| `infoekonomi.id` | timeout tidak konsisten |

Jangan dipaksa. Tampilkan opsi input manual.

## 9. Modul: Gemini (`lib/gemini.ts`)

**Model:** dari env `GEMINI_MODEL`, default `gemini-3.5-flash-lite` · **SDK:** `@google/genai` · **Env:** `GEMINI_API_KEY`, `GEMINI_MODEL`

> Kuota free tier terukur sendiri (angka resmi Google tidak cocok dengan akun ini):
> `gemini-2.5-flash` 20/hari + 10/menit · `gemini-3.5-flash-lite` 500/hari + 15/menit.
> Kuotanya **terpisah per model**. `gemini-2.5-flash-lite` membalas 404 walau masih
> terdaftar. Ukur ulang dengan `scripts/test-kuota.ts <model>`.

Sudah dipakai untuk newsletter sungguhan. Kualitas ringkasan layak pakai tanpa
edit pada sebagian besar artikel; yang perlu dijaga bukan mutunya, tapi
**panjangnya** dan **jiplakannya** (`lib/jiplak.ts` menolak ringkasan yang
menyalin sumber). Panjang target dihitung proporsional terhadap panjang sumber —
`targetKata()` — dan ditampilkan sebagai saran, bukan penghalang.

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

## 10. PDF (`app/api/export/route.ts` + `templates/newsletter.ts`)

Puppeteer → render HTML dari `renderNewsletter()` → PDF.

`lib/pdf.ts` tidak pernah dibuat: seluruh kodenya cuma perlu di satu rute, dan
memindahkannya ke modul sendiri hanya menambah lapisan.

Chromium-nya dua jalur. Di Vercel: `@sparticuz/chromium` lewat `puppeteer-core`.
Di lokal: `puppeteer` biasa yang membawa Chromium sendiri — itu sebabnya
`puppeteer` ada di **devDependencies**, bukan dependencies.

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
  articles: UiArticle[],       // terurut skor, BELUM di-resolve
  stats: { raw, unique, filtered, high, medium, low, failedQueries }
}
```

`UiArticle` (lihat `lib/ui.ts`) sengaja lebih ramping dari `ScoredArticle`:
`desc` dan `query` dibuang karena hasil pencarian bisa ~500 artikel sementara
sessionStorage cuma muat ~5 MB.

### `POST /api/resolve`
```ts
{ ids: string[] } → { results: Array<{ id, finalUrl, error? }> }
```

### `POST /api/extract`
```ts
{ urls: string[] }
  → { results: Array<{ url, fullText, imageUrl, warnings: string[], error? }> }
```
`warnings` lihat §8. URL divalidasi `lib/urlaman.ts` dulu — permintaan ke
jaringan lokal ditolak (SSRF).

### `POST /api/summarize`
```ts
{ articles: Array<{ title, fullText, sourceName }> }
  → { summaries: Array<{ summary, targetKata: [number, number],
                         warnings: string[], error?, pesanUser? }> }
```
`pesanUser` = kalimat kuota yang aman ditampilkan ke staf. Galat lain tidak
pernah ditulis mentah di layar.

### `POST /api/login`
```ts
{ password: string } → { ok: true } | 401
```
Membandingkan sandi dengan `lib/sandi.ts` (tahan timing attack), lalu memasang
cookie sesi. Semua rute lain dijaga `proxy.ts`.

### `POST /api/export`
```ts
{ publishDate, articles: Array<{ title, summary, imageBase64, url, sourceName }> }
  → Binary PDF
```

## 12. Environment

```env
GEMINI_API_KEY=xxx           # wajib
APP_PASSWORD=sandi-bersama   # wajib — sandi masuk aplikasi
GEMINI_MODEL=…               # opsional, default gemini-3.5-flash-lite
```

Tidak ada database. Ada auth: satu sandi bersama, dijaga `proxy.ts`.

**Kalau `APP_PASSWORD` tidak diset, aplikasi menolak SEMUA permintaan** —
fail-closed, bukan fail-open. Salah ketik nama variable tidak boleh berarti
aplikasinya terbuka.

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
| Summary per artikel | 1–2 detik (`gemini-3.5-flash-lite`) |

**Total sekali pakai, terukur pada uji pemakaian sungguhan: 8 menit 19 detik**
dari login sampai PDF di tangan — termasuk staf membaca dan mengedit ringkasan,
yang memakan waktu jauh lebih banyak daripada mesinnya.

> **Riwayat.** Perkiraan awal 2–5 detik per summary meleset jauh saat memakai
> `gemini-2.5-flash`: terukur 9–39 detik. Setelah pindah ke
> `gemini-3.5-flash-lite` turun ke 1–2 detik. Justru kecepatan itu yang jadi
> masalah baru: 3 slot tanpa jeda bisa memuntahkan 80–180 permintaan/menit,
> jauh di atas 15/menit. Karena itu `lib/antre.ts` mengunci laju di 2 slot +
> jeda 4,2 detik antar-mulai (~14/menit), tidak bergantung pada kecepatan model.
>
> Indikator progres tetap per artikel dan per tahap (FRONTEND.md §5) — bukan
> karena lambat, tapi karena tahap yang gagal harus bisa ditunjuk.
