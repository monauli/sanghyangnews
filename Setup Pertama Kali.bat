@echo off
setlocal
title Setup Pertama Kali - Sanghyang News
cd /d "%~dp0"

echo.
echo ==========================================================
echo    SETUP PERTAMA KALI - Sanghyang News
echo ==========================================================
echo.
echo  File ini cuma perlu dijalankan SEKALI, waktu aplikasi
echo  baru dipasang di komputer ini.
echo.
echo  Lamanya sekitar 3 sampai 10 menit, tergantung
echo  kecepatan internet. Jangan tutup jendela ini.
echo.

echo ----------------------------------------------------------
echo   Langkah 1 dari 4 - Memeriksa Node.js
echo ----------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 goto :node_tidak_ada
for /f "tokens=*" %%v in ('node --version 2^>nul') do set "NODEVER=%%v"
if not defined NODEVER goto :node_tidak_ada
echo   OK. Node.js %NODEVER% sudah terpasang.
echo.

echo ----------------------------------------------------------
echo   Langkah 2 dari 4 - Mengunduh komponen aplikasi
echo ----------------------------------------------------------
echo   Sedang mengunduh dari internet. Ini bagian paling lama.
echo   Tulisan yang lewat di bawah ini normal, tidak perlu dibaca.
echo.
call npm install --no-fund --no-audit
if errorlevel 1 goto :gagal_unduh
echo.
echo   OK. Semua komponen sudah terunduh.
echo.

echo ----------------------------------------------------------
echo   Langkah 3 dari 4 - Memeriksa berkas pengaturan
echo ----------------------------------------------------------
set "PERLU_ISI="
if exist ".env.local" goto :env_sudah_ada
if not exist ".env.example" goto :contoh_hilang
copy ".env.example" ".env.local" >nul
if errorlevel 1 goto :gagal_salin
set "PERLU_ISI=1"
echo   Berkas pengaturan belum ada, jadi baru saja dibuatkan.
goto :env_selesai

:env_sudah_ada
echo   OK. Berkas pengaturan sudah ada.
findstr /r /c:"^APP_PASSWORD=." ".env.local" >nul 2>nul
if errorlevel 1 set "PERLU_ISI=1"
findstr /r /c:"^GEMINI_API_KEY=." ".env.local" >nul 2>nul
if errorlevel 1 set "PERLU_ISI=1"

:env_selesai
echo.

echo ----------------------------------------------------------
echo   Langkah 4 dari 4 - Menyiapkan aplikasi
echo ----------------------------------------------------------
echo   Sedang menyiapkan. Butuh sekitar 1 sampai 3 menit.
echo.
call npm run build
if errorlevel 1 goto :gagal_siap
echo.
echo   OK. Aplikasi sudah siap.
echo.

if defined PERLU_ISI goto :belum_diisi

echo ==========================================================
echo    SETUP SELESAI
echo ==========================================================
echo.
echo  Mulai sekarang cukup klik dua kali:
echo.
echo      Jalankan Sanghyang.bat
echo.
echo  File itu ada di folder yang sama dengan file ini.
echo.
goto :habis


:belum_diisi
echo ==========================================================
echo    HAMPIR SELESAI - masih ada 1 hal
echo ==========================================================
echo.
echo  Aplikasinya sudah siap, TAPI berkas pengaturannya
echo  masih kosong dan harus diisi dulu.
echo.
echo  Berkas yang harus diisi ada di:
echo.
echo      %CD%\.env.local
echo.
echo  Buka berkas itu pakai Notepad, lalu isi dua baris ini:
echo.
echo      GEMINI_API_KEY=   (diisi kunci dari yang memasang)
echo      APP_PASSWORD=     (diisi sandi untuk masuk aplikasi)
echo.
echo  Isi tepat di belakang tanda sama dengan, tanpa spasi.
echo  Kalau tidak punya isinya, hubungi yang memasang aplikasi.
echo.
echo  Kalau sudah diisi dan disimpan, klik dua kali:
echo.
echo      Jalankan Sanghyang.bat
echo.
goto :habis


:node_tidak_ada
echo.
echo ==========================================================
echo    BERHENTI - Node.js belum terpasang
echo ==========================================================
echo.
echo  Aplikasi ini butuh program pendukung bernama Node.js,
echo  dan di komputer ini belum ada.
echo.
echo  Cara memasangnya:
echo.
echo    1. Buka browser, masuk ke alamat:  nodejs.org
echo    2. Pilih tombol versi LTS
echo       (biasanya tombol sebelah kiri, ada tulisan LTS)
echo    3. Buka berkas hasil unduhan itu, klik Next sampai selesai
echo    4. Setelah selesai, RESTART komputer
echo    5. Jalankan lagi file Setup Pertama Kali.bat ini
echo.
goto :habis


:contoh_hilang
echo.
echo ==========================================================
echo    BERHENTI - ada berkas yang hilang
echo ==========================================================
echo.
echo  Berkas contoh pengaturan (.env.example) tidak ditemukan
echo  di folder ini.
echo.
echo  Kemungkinan folder aplikasinya tidak lengkap saat disalin.
echo  Minta kiriman ulang folder aplikasi dari yang memasang.
echo.
goto :habis


:gagal_salin
echo.
echo ==========================================================
echo    BERHENTI - tidak bisa membuat berkas pengaturan
echo ==========================================================
echo.
echo  Windows menolak membuat berkas baru di folder ini.
echo.
echo  Biasanya karena foldernya ada di lokasi yang terkunci.
echo  Coba pindahkan seluruh folder aplikasi ke Documents,
echo  lalu jalankan file ini lagi dari sana.
echo.
goto :habis


:gagal_unduh
echo.
echo ==========================================================
echo    BERHENTI - gagal mengunduh komponen
echo ==========================================================
echo.
echo  Yang paling sering jadi penyebabnya:
echo.
echo    1. Internet putus atau sangat lambat
echo    2. Wifi kantor memblokir unduhan
echo.
echo  Coba periksa koneksi internetnya, lalu jalankan
echo  file ini lagi. Kalau tetap gagal, coba pakai
echo  koneksi internet lain.
echo.
goto :habis


:gagal_siap
echo.
echo ==========================================================
echo    BERHENTI - gagal menyiapkan aplikasi
echo ==========================================================
echo.
echo  Unduhannya berhasil, tapi tahap penyiapan gagal.
echo.
echo  Coba jalankan file ini sekali lagi. Kalau masih gagal,
echo  hubungi yang memasang aplikasi dan sebutkan tulisan
echo  merah yang muncul di atas.
echo.
goto :habis


:habis
echo ==========================================================
echo.
pause
endlocal
