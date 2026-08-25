import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium & Puppeteer harus di-require langsung oleh Node, jangan dibundel.
   * `puppeteer` sengaja ikut disebut walau cuma devDependency: di Vercel
   * cabangnya tidak pernah dijalankan, dan ini mencegah bundler mencoba
   * menariknya ke dalam berkas fungsi.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],

  /**
   * serverExternalPackages saja TIDAK CUKUP.
   *
   * Berkas biner Chromium (bin/*.br, 67 MB) tidak pernah di-`require` — alamatnya
   * baru dirangkai saat runtime oleh executablePath(). File tracing Vercel bekerja
   * dengan menelusuri require/import, jadi berkas itu tidak terlihat dan tidak ikut
   * ter-unggah. Gejalanya persis: "The input directory
   * /var/task/node_modules/@sparticuz/chromium/bin does not exist".
   *
   * Perhatikan bedanya dengan gejala "belum di-externalize" yang disebut README
   * @sparticuz/chromium — itu berbunyi "/var/task/bin", tanpa node_modules.
   * Paket kita sudah external; yang kurang cuma berkasnya ikut diangkut.
   */
  outputFileTracingIncludes: {
    "/api/export": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
