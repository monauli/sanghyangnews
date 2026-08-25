/** Ambang logika & UI. Terpisah dari keywords.ts yang isinya daftar kata. */

// Pengelompokan skor (BACKEND.md §7)
export const SCORE_TINGGI = 8;   // 🟢 >= 8   → tampil default
export const SCORE_SEDANG = 3;   // 🟡 3-7    → tampil di bawah, ⚪ < 3 disembunyikan

// Ambang kemiripan judul untuk badge "⚠️ mirip dengan #N"
export const DUPE_THRESHOLD = 0.55;
