@echo off
setlocal
title Sanghyang News - JANGAN TUTUP JENDELA INI
cd /d "%~dp0"

set "ALAMAT=http://localhost:3000"

echo.
echo ==========================================================
echo    Sanghyang News
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :node_tidak_ada

if not exist "node_modules\" goto :belum_setup
if not exist ".env.local" goto :belum_setup
if not exist ".next\BUILD_ID" goto :belum_setup

findstr /r /c:"^APP_PASSWORD=." ".env.local" >nul 2>nul
if errorlevel 1 goto :sandi_kosong

echo  Sedang menyalakan aplikasi. Tunggu sebentar,
echo  browser akan terbuka sendiri.
echo.

REM Menunggu di jendela terpisah: begitu aplikasinya siap menerima,
REM browser dibuka. Kalau 90 detik belum siap juga, berhenti menunggu
REM supaya tidak ada jendela yang menggantung diam-diam.
start "" /min powershell -NoProfile -Command "$n=0; $siap=$false; while ($n -lt 180) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',3000); $c.Close(); $siap=$true; break } catch { Start-Sleep -Milliseconds 500; $n++ } }; if ($siap) { Start-Sleep -Milliseconds 700; Start-Process 'http://localhost:3000' }"

echo ----------------------------------------------------------
echo.
echo   APLIKASI BERJALAN
echo.
echo   Alamatnya: %ALAMAT%
echo.
echo   JANGAN TUTUP JENDELA INI selama memakai aplikasi.
echo   Kalau sudah selesai, tutup jendela ini.
echo.
echo   Kalau browsernya tidak terbuka sendiri, buka browser
echo   lalu ketik alamat di atas.
echo.
echo ----------------------------------------------------------
echo.

call npm start

echo.
echo ==========================================================
echo    Aplikasi berhenti
echo ==========================================================
echo.
echo  Kalau ini terjadi sendiri padahal kamu belum selesai,
echo  tutup jendela ini lalu klik dua kali lagi file
echo  Jalankan Sanghyang.bat.
echo.
echo  Kemungkinan lain: aplikasinya sudah terbuka di jendela
echo  lain. Cek dulu apakah ada jendela hitam serupa yang
echo  masih terbuka sebelum menyalakan ulang.
echo.
goto :habis


:node_tidak_ada
echo ==========================================================
echo    BELUM BISA DIJALANKAN
echo ==========================================================
echo.
echo  Program pendukung yang dibutuhkan aplikasi ini belum
echo  terpasang di komputer ini.
echo.
echo  Klik dua kali file ini dulu:
echo.
echo      Setup Pertama Kali.bat
echo.
echo  File itu ada di folder yang sama dengan file ini,
echo  dan akan memandu pemasangannya.
echo.
goto :habis


:belum_setup
echo ==========================================================
echo    BELUM SIAP DIJALANKAN
echo ==========================================================
echo.
echo  Aplikasi ini belum selesai dipasang di komputer ini.
echo.
echo  Klik dua kali file ini dulu:
echo.
echo      Setup Pertama Kali.bat
echo.
echo  File itu ada di folder yang sama dengan file ini.
echo  Tunggu sampai muncul tulisan Setup Selesai, baru
echo  jalankan lagi file Jalankan Sanghyang.bat.
echo.
goto :habis


:sandi_kosong
echo ==========================================================
echo    BELUM BISA DIJALANKAN - pengaturan masih kosong
echo ==========================================================
echo.
echo  Berkas pengaturannya ada, tapi sandi masuk aplikasinya
echo  belum diisi. Tanpa itu aplikasi menolak semua orang.
echo.
echo  Berkas yang harus diisi ada di:
echo.
echo      %CD%\.env.local
echo.
echo  Buka pakai Notepad, lalu isi baris APP_PASSWORD=
echo  tepat di belakang tanda sama dengan, tanpa spasi.
echo.
echo  Kalau tidak tahu isinya, hubungi yang memasang aplikasi.
echo.
goto :habis


:habis
echo ==========================================================
echo.
pause
endlocal
