@echo off
setlocal enabledelayedexpansion
cd /d "D:\BOT\NamyStore VPS Bot"

echo [1/6] Mengecek Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git tidak ditemukan di sistem. Silakan install Git terlebih dahulu.
    pause
    exit /b
)

echo [2/6] Inisialisasi Git (jika belum)...
if not exist ".git" (
    git init
)

echo [3/6] Mengatur remote origin...
git remote -v | findstr /C:"origin" >nul
if %errorlevel%==0 (
    git remote set-url origin https://github.com/namydevx/namystore-vps-bot.git
) else (
    git remote add origin https://github.com/namydevx/namystore-vps-bot.git
)

echo [4/6] Menambahkan semua file...
git add .

echo [5/6] Commit perubahan (jika ada)...
git diff --cached --exit-code >nul
if %errorlevel%==1 (
    git commit -m "Auto push NamyStore VPS Bot"
) else (
    echo [Info] Tidak ada perubahan untuk di-commit.
)

echo [6/6] Set branch ke main dan push...
git branch -M main
git push -u origin main

echo.
echo ✅ Push selesai! Tekan tombol apa saja untuk keluar...
pause >nul
