# Wise Trading Discord Bot 📊🪙📈

Discord Bot untuk memantau nilai harga dan grafik dari **Mata Uang (Forex)**, **Cryptocurrency**, dan **Saham** secara real-time. Bot ini dibuat menggunakan **Node.js** dengan **TypeScript** (ES Modules) dan diintegrasikan dengan Yahoo Finance API serta QuickChart.

---

## ✨ Fitur Utama

1.  **🔍 Informasi Harga Real-time (`/price`)**
    *   Mendapatkan harga aset saat ini lengkap dengan informasi perubahan harian (24 jam), harga pembukaan (open), serta batas tertinggi dan terendah harian.
    *   Mendukung Saham Global/Lokal (contoh: `AAPL`, `TSLA`, `BBCA.JK`), Crypto (`BTC-USD`, `ETH-USD`), dan Forex (`USDIDR=X`, `EURUSD=X`).
2.  **📊 Grafik Historis (`/chart`)**
    *   Merender dan mengirimkan grafik pergerakan harga historis dalam bentuk gambar PNG interaktif langsung ke Discord.
    *   Mendukung rentang waktu: 1 Hari (Intraday), 5 Hari, 1 Minggu, 1 Bulan, 3 Bulan, 6 Bulan, dan 1 Tahun.
    *   Warna grafik dinamis: Hijau neon jika harga naik secara keseluruhan pada periode tersebut, dan merah neon jika turun.
3.  **🚨 Alarm Harga Target (`/alert`)**
    *   Mengatur target harga tertentu. Bot akan memantau pasar secara real-time di background dan memberi tahu (mention) Anda jika target harga tercapai.
4.  **⚡ Alarm Persentase (Volatility Alerts - `/volatility`)**
    *   Mendeteksi fluktuasi harga mendadak. Bot akan mengirimkan peringatan jika harga suatu aset naik atau turun melampaui persentase tertentu (misalnya ±3%) dari harga acuan, lalu memperbarui harga acuan tersebut secara otomatis.
5.  **🔔 Update Berkala Otomatis (`/periodic`)**
    *   Mengirimkan ringkasan harga terbaru beserta grafiknya secara otomatis ke channel Discord pilihan Anda pada interval waktu tertentu (1 jam, 4 jam, 12 jam, atau 24 jam).
6.  **📋 Watchlist Dashboard (`/watchlist`)**
    *   Melihat ringkasan harga beberapa aset sekaligus dalam satu pesan ringkas yang ramah seluler (*mobile-friendly*).
7.  **🔄 Reset Pengaturan (`/reset`)**
    *   Fitur khusus Administrator server untuk menghapus database pemantauan secara keseluruhan atau per kategori.

---

## 🛠️ Tech Stack & Library

*   **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Discord API Wrapper**: [discord.js](https://discord.js.org/) (v14)
*   **Financial Data API**: [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) (v3)
*   **Chart Rendering**: [QuickChart API](https://quickchart.io/) (Renders Chart.js configurations server-side)
*   **Process Manager**: [PM2](https://pm2.keymetrics.io/) (Untuk deployment background 24/7)

---

## 🚀 Panduan Setup & Instalasi

### 1. Prasyarat
Pastikan Anda sudah menginstal:
*   Node.js (versi 18 ke atas)
*   Git

### 2. Kloning Repositori
```bash
git clone https://github.com/FloatingDancer/wise-trading-discord-bot.git
cd wise-trading-discord-bot
```

### 3. Instal Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment
Buat file bernama `.env` di folder utama proyek Anda dan isi kredensial bot Anda (gunakan `.env.example` sebagai contoh):
```env
DISCORD_TOKEN=BOT_TOKEN_DISCORD_ANDA
DISCORD_CLIENT_ID=CLIENT_ID_APPLICATION_ANDA
DISCORD_GUILD_ID=SERVER_ID_UNTUK_DEVELOPMENT
```

### 5. Kompilasi & Registrasi Command
Lakukan kompilasi kode TypeScript ke JavaScript:
```bash
npm run build
```

Daftarkan semua Slash Commands ke server Discord Anda:
```bash
node dist/register-commands.js
```

### 6. Menjalankan Bot
Untuk mode pengembangan (*development*):
```bash
npm run dev
```
Untuk menjalankan langsung (*production*):
```bash
npm start
```

---

## ⚙️ Menjalankan Nonstop di Background (Windows/Linux) via PM2

Agar bot tidak mati saat Anda menutup terminal, gunakan **PM2**:

1.  **Instal PM2 secara global**:
    ```bash
    npm install pm2 -g
    ```
2.  **Jalankan bot menggunakan PM2**:
    ```bash
    pm2 start dist/index.js --name "discord-bot"
    ```
3.  **Aktifkan auto-startup saat komputer menyala**:
    *   **Windows**:
        ```bash
        npm install pm2-windows-startup -g
        pm2-startup install
        pm2 save
        ```
    *   **Linux**:
        ```bash
        pm2 startup
        # Jalankan perintah keluaran yang diinstruksikan oleh terminal
        pm2 save
        ```
