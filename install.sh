#!/bin/bash

echo "🚀 Memulai instalasi NamyStore VPS Bot..."

# Update & install dependensi dasar
apt update && apt upgrade -y
apt install -y git curl wget

# Install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Cek Node dan npm
node -v
npm -v

# Clone project jika belum ada
if [ ! -d "NamyStore-VPS-Bot" ]; then
    git clone https://github.com/Namydevx/NamyStore-VPS-Bot.git
fi

cd NamyStore-VPS-Bot

# Install semua module yang diperlukan
npm install

# Jalankan bot
echo "✅ Instalasi selesai. Menjalankan bot..."
node index.js
