@echo off
setlocal
title Sanghyang News - JANGAN TUTUP JENDELA INI
cd /d "%~dp0"

REM Keluaran npm/Next memakai UTF-8. Tanpa ini staf melihat "â–²" dan
REM "âœ“" berserakan dan mengira ada yang rusak. Pesan kita sendiri
REM semuanya ASCII, jadi tidak terpengaruh.
chcp 65001 >nul 2>nul

set "DAFTAR_PORT=3000 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010"

echo.
echo ==========================================================
echo    Sanghyang News
echo ==========================================================
echo.

REM Nomor port tidak dipatok ke 3000. Program lain boleh saja memakainya -
REM aplikasi ini jalan sama baiknya di 3001. Staf tidak perlu tahu angkanya
REM dan tidak perlu disuruh menutup program lain.
REM
REM Dua sapuan, urutannya penting:
REM   1. cari Sanghyang yang SUDAH jalan di salah satu port
REM   2. kalau tidak ada, baru cari port kosong pertama
REM Kalau dibalik, staf yang klik dua kali lima kali akan menjalankan lima
REM aplikasi di lima port berbeda.

REM curl dipakai untuk memastikan yang menjawab memang aplikasi ini, bukan
REM aplikasi lain yang kebetulan memakai portnya. Ada bawaan Windows 10
REM sejak 2018. Kalau tidak ada, sapuan 1 dilewati: aplikasi tetap jalan
REM di port kosong, cuma deteksi "sudah jalan" tidak aktif.
set "ADA_CURL=1"
where curl >nul 2>nul
if errorlevel 1 set "ADA_CURL="

set "PORT_JALAN="
for %%p in (%DAFTAR_PORT%) do call :cari_sanghyang %%p
if defined PORT_JALAN goto :sudah_jalan

set "PORT_KOSONG="
for %%p in (%DAFTAR_PORT%) do call :cari_kosong %%p
if not defined PORT_KOSONG goto :semua_penuh
set "ALAMAT=http://localhost:%PORT_KOSONG%"

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
start "" /min powershell -NoProfile -Command "$n=0; $siap=$false; while ($n -lt 180) { try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%PORT_KOSONG%); $c.Close(); $siap=$true; break } catch { Start-Sleep -Milliseconds 500; $n++ } }; if ($siap) { Start-Sleep -Milliseconds 700; Start-Process '%ALAMAT%' }"

echo ----------------------------------------------------------
echo.
echo   APLIKASI BERJALAN
echo.
echo   Browser sudah dibuka sendiri.
echo.
echo   JANGAN TUTUP JENDELA INI selama memakai aplikasi.
echo   Kalau sudah selesai, tutup jendela ini.
echo.
echo   Kalau browsernya tidak muncul, buka browser lalu
echo   ketik alamat ini:  %ALAMAT%
echo.
echo ----------------------------------------------------------
echo.

call npm start -- -p %PORT_KOSONG%

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


:sudah_jalan
set "ALAMAT=http://localhost:%PORT_JALAN%"
start "" "%ALAMAT%"
echo ==========================================================
echo    APLIKASI SUDAH BERJALAN
echo ==========================================================
echo.
echo  Tidak ada yang salah. Aplikasinya memang sudah menyala
echo  di jendela lain, jadi tidak perlu dinyalakan dua kali.
echo.
echo  Browser sudah dibuka ke alamatnya. Kalau tidak muncul,
echo  buka browser lalu ketik:  %ALAMAT%
echo.
echo  Jendela ini boleh ditutup.
echo  JANGAN tutup jendela satunya - di situ aplikasinya jalan.
echo.
goto :habis


:semua_penuh
echo ==========================================================
echo    BELUM BISA DIJALANKAN
echo ==========================================================
echo.
echo  Komputer ini sedang menjalankan banyak program lain,
echo  sampai aplikasi ini tidak kebagian tempat.
echo.
echo  Ini jarang terjadi. Yang paling cepat: RESTART komputer,
echo  lalu jalankan lagi file ini.
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
exit /b


REM ---- subrutin pencari port ----
REM Dipanggil dengan call, jadi variabelnya tetap terbaca di luar.
REM Batch tidak punya break di dalam for, jadi tiap subrutin langsung
REM keluar begitu jawabannya sudah ketemu.

REM Port %1 hidup DAN yang menjawab aplikasi ini? Simpan nomornya.
:cari_sanghyang
if defined PORT_JALAN goto :eof
if not defined ADA_CURL goto :eof
call :port_hidup %1
if errorlevel 1 goto :eof
curl -s -m 5 "http://localhost:%1/login" 2>nul | findstr /i "Sanghyang" >nul 2>nul
if errorlevel 1 goto :eof
set "PORT_JALAN=%1"
goto :eof

REM Port %1 belum dipakai siapa pun? Simpan nomornya.
:cari_kosong
if defined PORT_KOSONG goto :eof
call :port_hidup %1
if not errorlevel 1 goto :eof
set "PORT_KOSONG=%1"
goto :eof

REM errorlevel 0 = ada yang mendengarkan di port %1, 1 = kosong.
REM Dua findstr, bukan satu: findstr ":3000" ikut mencocokkan :30000.
REM Spasi di ":%1 " itu yang memotongnya - netstat memberi jarak setelah
REM nomor port di kolom alamat lokal.
:port_hidup
netstat -an | findstr "LISTENING" | findstr /c:":%1 " >nul 2>nul
goto :eof
