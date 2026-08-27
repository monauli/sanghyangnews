/** Ambang logika & UI. Terpisah dari keywords.ts yang isinya daftar kata. */

// Pengelompokan skor (BACKEND.md §7)
export const SCORE_TINGGI = 8;   // 🟢 >= 8   → tampil default
export const SCORE_SEDANG = 3;   // 🟡 3-7    → tampil di bawah, ⚪ < 3 disembunyikan

// Ambang kemiripan judul untuk penanda gugus berita serupa.
// Turun dari 0,55 setelah diukur pada korpus Juli 2026 (37 artikel grup tinggi).
// Tiap pasangan baru diperiksa manual:
//   0,55 →  5 pasang,  9 artikel bertanda  (keadaan lama)
//   0,50 → 14 pasang, 12 artikel — 9 pasang baru, positif palsu 0
//   0,45 → 15 pasang, 13 artikel — 1 pasang baru, positif palsu 0  ← dipakai
//   0,40 → 18 pasang, 13 artikel — 3 pasang baru, 1 meragukan
// 0,40 mulai menyatukan sudut berita yang sah berbeda ("jumlah kunjungan"
// vs "jaminan aman"), jadi berhenti di 0,45.
export const DUPE_THRESHOLD = 0.45;
