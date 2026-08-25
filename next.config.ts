import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Chromium & Puppeteer harus di-require langsung oleh Node, jangan dibundel.
   * `puppeteer` sengaja ikut disebut walau cuma devDependency: di Vercel
   * cabangnya tidak pernah dijalankan, dan ini mencegah bundler mencoba
   * menariknya ke dalam berkas fungsi.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
};

export default nextConfig;
