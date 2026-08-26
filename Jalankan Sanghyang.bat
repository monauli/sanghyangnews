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

REM Aplikasinya mungkin sudah dinyalakan di jendela lain dan staf lupa.
REM Kalau alamatnya sudah hidup, JANGAN nyalakan yang kedua: cukup buka
REM browsernya. Menyalakan yang kedua bikin jendela ini mati sendiri, dan
REM staf mengira itu error lalu menutup jendela pertama - yang justru
REM mematikan aplikasi yang sedang dipakai.
REM Dua findstr, bukan satu: findstr ":3000" saja ikut mencocokkan :30000.
netstat -an | findstr "LISTENING" | findstr /c:":3000 " >nul 2>nul
if errorlevel 1 goto :alamat_kosong

REM Alamatnya terpakai - tapi belum tentu oleh aplikasi ini. Terbukti di
REM komputer pengembang: aplikasi Next.js lain memakai alamat yang sama.
REM Kalau langsung dianggap "sudah jalan", browser terbuka ke aplikasi
REM yang salah dan staf tidak akan paham kenapa. Jadi ditanya dulu.
where curl >nul 2>nul
if errorlevel 1 goto :sudah_jalan
curl -s -m 5 "%ALAMAT%/login" 2>nul | findstr /i "Sanghyang" >nul 2>nul
if errorlevel 1 goto :dipakai_lain
goto :sudah_jalan

:alamat_kosong

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


:sudah_jalan
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


:dipakai_lain
echo ==========================================================
echo    ALAMATNYA SEDANG DIPAKAI PROGRAM LAIN
echo ==========================================================
echo.
echo  Alamat %ALAMAT% sudah dipakai
echo  program lain di komputer ini, bukan aplikasi Sanghyang.
echo.
echo  Aplikasi ini tidak bisa memakai alamat yang sama.
echo.
echo  Yang harus dilakukan:
echo    1. Tutup program lain itu dulu
echo       (biasanya jendela hitam serupa milik aplikasi lain)
echo    2. Kalau tidak tahu program apa, RESTART komputer
echo    3. Setelah itu jalankan lagi file ini
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
