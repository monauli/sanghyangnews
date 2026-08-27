/**
 * Semua daftar kata & bobot. Disalin apa adanya dari spike5.mjs
 * (sudah teruji: 669 mentah → 441 unik → 307 lolos → 28 skor tinggi).
 * Jangan diotak-atik tanpa uji ulang.
 */

// ---------- QUERY ----------
// Lokasi kecil: query sendiri (semua beritanya memang lokal)
export const LOC_KECIL = ['Anyer', 'Carita', 'Cinangka', 'Cikoneng'];

// Lokasi besar: WAJIB dipasangkan topik, kalau tidak hasilnya mentok batas 100 & generik
export const LOC_BESAR = ['Serang', 'Cilegon', 'Banten'];
export const TOPIK_QUERY = ['wisata', 'hotel', 'investasi', 'pariwisata', 'festival'];

// 4 + (3 × 5) = 19 query
export const QUERIES = [
  ...LOC_KECIL,
  ...LOC_BESAR.flatMap((l) => TOPIK_QUERY.map((t) => `${l} ${t}`)),
];

// Lokasi wajib muncul di JUDUL (lowercase)
export const LOC_KEYS = ['anyer', 'carita', 'cinangka', 'cikoneng', 'serang', 'cilegon', 'banten'];

/**
 * "serang" satu-satunya kata lokasi yang juga KATA KERJA bahasa Indonesia
 * ("saling serang", "Israel kembali serang Gaza"). Kata lokasi lain tidak ambigu.
 *
 * Karena itu "serang" saja tidak cukup meloloskan artikel — harus ada penguat
 * konteks Banten di judul atau ringkasannya. Menambah nama kota luar ke
 * REGIONAL_BLACKLIST tidak akan pernah selesai: Purbalingga hari ini, kota lain
 * besok. Yang disyaratkan konteksnya, bukan daftar larangan.
 */
export const PENGUAT_SERANG = [
  'banten',
  'anyer', 'carita', 'cinangka', 'cikoneng', 'cilegon',

  // Jabatan atau satuan administratif + "Serang" — tidak mungkin kata kerja.
  // Ditulis sebagai satu pola, bukan didaftar satu-satu: "Bupati Serang",
  // "Pemkab Serang", "DPRD Serang", "Polres Serang", "Dinas Pariwisata Serang"
  // semuanya tertangkap tanpa perlu menambah entri tiap kali ketemu yang baru.
  '(?:bupati|wakil bupati|wali ?kota|pemkab|pemkot|pemda|kabupaten|kab\\.?|kota'
    + '|dprd|polres(?:ta)?|polda|kejari|kejaksaan|kodim|lapas|rsud'
    + '|bapenda|bappeda|bpbd|disporapar|dishub|disdik|dinkes'
    + '|dinas [a-z ]{0,20}) serang',

  'serang (?:raya|timur|barat|utara|selatan)',
  // Ruas tol di Banten. Pemisahnya bisa spasi, hubung, atau EN-DASH — portal
  // menulis "Serang – Panimbang" dengan – , dan pola [ -] saja melewatkannya.
  'serang\\s*[-–—]?\\s*panimbang',

  // "di Serang" hampir selalu keterangan TEMPAT ("Festival Ngabring di Serang").
  // Sebagai kata kerja bentuknya "saling serang" / "kembali serang" /
  // "ancam serang" — tidak pernah didahului "di".
  'di serang',
];

// ---------- BOBOT SKOR ----------
export type WeightGroup = { score: number; words: string[] };

export const W_WISATA: WeightGroup = {
  score: 5,
  words: ['wisata', 'pariwisata', 'wisatawan', 'destinasi', 'resort', 'hotel',
    'penginapan', 'homestay', 'kuliner', 'pantai', 'desa wisata', 'okupansi'],
};

export const W_EKONOMI: WeightGroup = {
  score: 3,
  words: ['investasi', 'psn', 'proyek strategis', 'infrastruktur', 'tol',
    'pelabuhan', 'bandara', 'pembangunan', 'ekonomi', 'industri', 'pabrik',
    'lapangan kerja', 'umkm'],
};

export const W_ACARA: WeightGroup = {
  score: 3,
  words: ['festival', 'event', 'pameran', 'expo', 'pesta laut', 'karnaval', 'gelaran'],
};

export const W_PEJABAT: WeightGroup = {
  score: 2,
  words: ['gubernur', 'menteri', 'mendes', 'bupati', 'walikota', 'wali kota',
    'peresmian', 'resmikan', 'soft opening', 'kerja sama', 'groundbreaking'],
};

// Birokrasi internal — tidak layak newsletter hotel
export const W_BIROKRASI: WeightGroup = {
  score: -6,
  words: ['raperda', 'apbd', 'pertanggungjawaban', 'mutasi', 'sekwan', 'bpk',
    'monev', 'paripurna', 'banggar', 'lhp', 'interpelasi', 'beasiswa',
    'silpa', 'lkpj', 'reses', 'pansus', 'audit', 'honorer', 'asn', 'p3k'],
};

export const LISTICLE = [
  'tak perlu', 'gak perlu', 'nggak perlu', 'rasa bali', 'hidden gem',
  'estetik', 'ramah kantong', 'murah meriah', 'anti mainstream',
  'weekend escape', 'wajib dikunjungi', 'wajib coba', 'rekomendasi',
  'ini dia', 'dijamin', 'bikin betah', 'cocok untuk', 'saingi',
  'butuh ', 'cari ', 'viral', 'ternyata', 'instagramable', 'instagenic',
  'spot foto', 'berburu senja', 'oase', 'bosan ',
];

export const BLACKLIST = [
  'sepak bola', 'liga', 'persita', 'artis', 'gosip',
  'tewas', 'meninggal', 'tenggelam', 'terseret', 'korban', 'jenazah',
  'hilang', 'kebakaran', 'banjir', 'longsor', 'gempa',
  'begal', 'narkoba', 'pencurian', 'penipuan', 'curanmor', 'razia',
  'ditangkap', 'tersangka', 'korupsi', 'penganiayaan',
  'pilkada', 'pemilu', 'kampanye', 'partai',
];

/**
 * Tempat di luar jangkauan hotel. Dicek di JUDUL saja (setelah akhiran " - NamaSumber" dibuang).
 * Terpisah dari BLACKLIST supaya alasan pembuangan bisa dilaporkan sendiri.
 * CATATAN: Pandeglang sengaja TIDAK di sini — Carita masuk Kabupaten Pandeglang.
 */
export const REGIONAL_BLACKLIST = [
  // luar Banten
  'blitar', 'kendal', 'tulungagung', 'jawa timur', 'jawa tengah',
  'semarang', 'malang', 'yogyakarta',
  // Banten tapi terlalu jauh dari Anyer
  'tangerang', 'tangsel', 'tangerang selatan', 'serpong', 'cipondoh',
  'bsd', 'lebak', 'rangkasbitung',
];

/**
 * Portal iklan & marketplace. Dicek di DOMAIN sumber (atribut url pada <source>),
 * BUKAN judul: "DIJUAL PONDOK TUBAGUS RESORT / VILLA at PANTAI CARITA ANYER"
 * dari Rumah123 lolos skoring karena kata "resort" + lokasi Carita/Anyer.
 * Terpisah dari BLACKLIST supaya alasan pembuangannya bisa dilaporkan sendiri.
 *
 * Pola judul ("dijual", "disewakan") sengaja TIDAK dipakai — di data Juli 2026
 * satu-satunya judul non-marketplace yang kena adalah berita sah:
 * "Hotel The Royale Krakatau Cilegon Dijual, PT KSI Diminta Fokus…".
 */
export const SUMBER_BLACKLIST = [
  'rumah123', 'olx', 'lamudi', '99.co', 'tokopedia', 'shopee', 'bukalapak',
  'travelio', 'airbnb', 'agoda', 'booking.com', 'tiket.com', 'traveloka',
];

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
