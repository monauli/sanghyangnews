/**
 * Penjaga akses. URL Vercel itu publik — tanpa ini siapa pun yang menemukannya
 * bisa menghabiskan kuota Gemini.
 *
 * Satu sandi bersama, disimpan di cookie httpOnly. Bukan sistem akun:
 * tujuannya menahan orang lewat dan bot, bukan mengatur hak per orang.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export const NAMA_COOKIE = 'sanghyang_masuk';
export const UMUR_COOKIE = 60 * 60 * 24 * 30;   // 30 hari — staff tidak login ulang tiap buka

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/**
 * Perbandingan yang tidak membocorkan lewat lama waktu.
 * `===` berhenti di karakter pertama yang beda, jadi lama prosesnya
 * memberi tahu penebak berapa karakter awal yang sudah benar.
 * Kedua sisi di-hash dulu supaya panjangnya selalu sama (32 bita).
 */
export function sandiCocok(diberikan: unknown, benar: string): boolean {
  if (typeof diberikan !== 'string' || !benar) return false;
  return timingSafeEqual(sha256(diberikan), sha256(benar));
}

/** Isi cookie: turunan sandi, bukan sandinya sendiri. */
export const tokenDari = (sandi: string) => sha256(sandi).toString('hex');

export function tokenSah(token: unknown, sandi: string): boolean {
  if (typeof token !== 'string' || !sandi) return false;
  const a = Buffer.from(token, 'hex');
  const b = sha256(sandi);
  return a.length === b.length && timingSafeEqual(a, b);
}
