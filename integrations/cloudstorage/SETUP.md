# Setup Guide: Personal Cloud Storage (Telegram-backed)

Panduan lengkap untuk menjalankan Telegram Bot API Server dan aplikasi Cloud Storage.

---

## 1. Prasyarat

1. **Docker & Docker Compose** (Direkomendasikan untuk menjalankan Telegram Bot API Server lokal).
2. **Go (Golang)** versi 1.21 atau lebih baru.
3. Akun Telegram dan Bot Token dari [@BotFather](https://t.me/BotFather).
4. Akun Telegram Developer (`api_id` dan `api_hash`) dari [my.telegram.org](https://my.telegram.org).

---

## 2. Setup Telegram Bot API Server Lokal

Menggunakan image resmi `aiogram/telegram-bot-api` agar batasan ukuran file terangkat menjadi hingga 2GB/4GB.

Buat file `docker-compose.yml` di folder root (atau folder terpisah):

```yaml
version: "3.8"

services:
  telegram-bot-api:
    image: aiogram/telegram-bot-api:latest
    container_name: telegram-bot-api
    restart: always
    environment:
      - TELEGRAM_API_ID=YOUR_API_ID
      - TELEGRAM_API_HASH=YOUR_API_HASH
    ports:
      - "8081:8081"
    volumes:
      - telegram-data:/var/lib/telegram-bot-api

volumes:
  telegram-data:
```

Ganti `YOUR_API_ID` dan `YOUR_API_HASH` dengan kredensial dari `my.telegram.org`.
Jalankan server:

```bash
docker-compose up -d
```

---

## 3. Konfigurasi Environment (`.env`)

Buat file `.env` di root direktori proyek:

```env
PORT=8080
TELEGRAM_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=1814002506
TELEGRAM_API=http://localhost:8081
DB_PATH=./cloudstorage.db

# Opsional:
# HOST=127.0.0.1            # Bind address (kosong = semua interface). Direkomendasikan 127.0.0.1
# AUTH_TOKEN=rahasia-kuat   # Aktifkan autentikasi token sederhana untuk seluruh UI/API
# THUMB_CACHE_DIR=./thumbcache
# MAX_UPLOAD_SIZE=2147483648
# ALLOWED_ORIGINS=https://drive.example.com   # Batasi origin CORS (pisah dengan koma); kosong = semua origin
# SHARE_EXPIRY_DAYS=30      # Masa berlaku link share dalam hari (0 = tidak pernah kedaluwarsa)
# THUMB_CLEAN_HOURS=24      # Interval pembersihan thumbcache stale dalam jam (0 = nonaktif)
```

Jika `AUTH_TOKEN` diisi, seluruh UI dan API (kecuali halaman share `/s/:token`)
membutuhkan token tersebut. Login dilakukan lewat halaman `/login`; token
divalidasi server via `POST /api/login` (dengan pembatasan percobaan), bukan
sekadar disimpan di browser. Token tidak lagi diterima lewat query string
`?token=` demi keamanan.

---

## 4. Menjalankan Aplikasi

1. **Inisialisasi & Tidy Go Modules:**

   ```bash
   go mod tidy
   ```

2. **Jalankan Mode Development:**

   ```bash
   go run cmd/server/main.go
   ```

3. **Build Binary Mandiri (Single Binary):**

   ```bash
   go build -o cloudstorage.exe cmd/server/main.go
   ```

   _Frontend sudah otomatis ter-embed di dalam binary via `go:embed`._

4. Buka browser dan akses: `http://localhost:8080`

---

## 5. Backup Database

Buat snapshot database (konsisten, termasuk data WAL) tanpa menghentikan server:

```bash
cloudstorage.exe -backup ./backup-2025-01-01.db
```

Hasilnya file SQLite tunggal yang aman disalin/disimpan. Untuk memulihkan,
hentikan server lalu ganti file `DB_PATH` dengan file backup tersebut.
