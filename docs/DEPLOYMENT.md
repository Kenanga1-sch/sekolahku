# 🚀 Deployment Guide: Sekolahku (Podman Container)

Panduan deployment resmi dan lengkap untuk AI Agent & Pengembang dalam melakukan deployment proyek **Sekolahku** ke server produksi menggunakan **Podman**.

---

## 🏗️ Arsitektur Deployment

Aplikasi Sekolahku menggunakan container **Podman**:

```
sdn1kenanga.sch.id
    │
    ▼ Cloudflare Edge
    │
    ▼ Cloudflare Tunnel (cloudflared)
    │
    ▼ localhost:3000 (Host Server)
    │
    ▼ Podman Container (sekolahku:latest)
         ├─ Port: 3000 (HTTP API + Next.js Static Assets)
         ├─ Database: /home/kenanga/sekolahku-deploy/data/sekolahku.db (SQLite - Mounted Volume)
         ├─ Uploads: /home/kenanga/sekolahku-deploy/uploads (Mounted Volume)
         └─ Telegram Backup (Opsional): aiogram/telegram-bot-api
```

### Karakteristik Utama:
- **Containerized Runtime**: Berjalan di dalam container Podman (rootless mode), aman dan terisolasi.
- **Embedded Frontend**: Next.js di-build sebagai static export dan di-embed ke dalam binary Go via `embed.FS`.
- **Single Executable in Container**: Seluruh aplikasi berjalan dari satu file binary di dalam image berbasis Alpine Linux (~80 MB total).
- **SQLite Database**: Database lokal dengan WAL mode dan auto-repair schema, dipetakan via Docker volume (`-v`).

---

## 📋 Prasyarat Server Produksi

- **OS**: Linux x86_64 (Debian 13 diprioritaskan)
- **RAM Minimum**: 1GB
- **Akses**: SSH dengan akses `sudo` (atau user `kenanga`)
- **Container Engine**: Podman terinstal
- **Networking**: Cloudflare Tunnel (`cloudflared`) terkonfigurasi mengarah ke `http://localhost:3000`

---

## 🔄 Alur Rilis (Versi)

Setiap kali melakukan deployment, **WAJIB** menaikkan nomor versi aplikasi di dua file berikut:

1. **`app/layout.tsx`**: Update atribut `#app-version` (misal: `v1.1.014` → `v1.1.015`)
2. **`lib/api-client.ts`**: Update konstanta `APP_VERSION` (misal: `v1.1.014` → `v1.1.015`)

---

## 🛠️ Langkah Build (Lokal)

Build dilakukan di komputer pengembang (Windows/Linux) menggunakan script cross-compile:

### Di Windows (PowerShell):
```cmd
build-linux.bat
```

Script ini melakukan 4 langkah otomatis:
1. `npm run build` — Next.js static export ke `out/`
2. Membersihkan & membuat folder `go-backend/cmd/api/dist/`
3. Salin seluruh isi `out/*` ke `go-backend/cmd/api/dist/`
4. Kompilasi binary Linux (`GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ..\sekolahku_linux .\cmd\api`).

Output file: **`sekolahku_linux`** di root proyek.

---

## 📦 Langkah Deployment ke Server

### 1. Upload File ke Server
Upload `sekolahku_linux`, `Dockerfile`, dan pastikan `.env` tersedia di `/home/kenanga/sekolahku-deploy/`:

```bash
scp sekolahku_linux Dockerfile kenanga@100.97.52.50:/home/kenanga/sekolahku-deploy/
```

### 2. Build Image & Jalankan Container di Server
Masuk ke server via SSH, lalu jalankan:

```bash
cd /home/kenanga/sekolahku-deploy
podman build -t sekolahku:latest .
```

### 3. Konfigurasi Container & Systemd Auto-Start
Hentikan container lama (jika ada) dan jalankan container baru dengan volume mapping:

```bash
podman rm -f sekolahku
podman run -d --name sekolahku --restart=always --network=host \
  -v /home/kenanga/sekolahku-deploy/data:/app/data \
  -v /home/kenanga/sekolahku-deploy/uploads:/app/uploads \
  --env-file /home/kenanga/sekolahku-deploy/.env \
  localhost/sekolahku:latest
```

Untuk memastikan container otomatis berjalan setelah server reboot (systemd rootless):
```bash
podman generate systemd --new --name sekolahku > ~/.config/systemd/user/container-sekolahku.service
systemctl --user daemon-reload
systemctl --user enable container-sekolahku.service
```

---

## 🔍 Verifikasi & Monitoring

### Health Check
```bash
curl http://127.0.0.1:3000/api/health
# Harus mengembalikan: {"status":"OK"}
```

### Cek Logs Container
```bash
podman logs --tail 50 -f sekolahku
```

### Cek Status Port
```bash
ss -tlnp | grep 3000
```

---

## 🛡️ Backup & Recovery

### Backup Database Manual
```bash
cp /home/kenanga/sekolahku-deploy/data/sekolahku.db \
   /home/kenanga/sekolahku-deploy/data/sekolahku.db.bak.$(date +%Y%m%d)
```

---

## 🚨 Troubleshooting

### Error: 502 Bad Gateway di Browser
1. Cek status container: `podman ps`
2. Cek logs: `podman logs sekolahku`
3. Pastikan port `3000` aktif dan container menggunakan `--network=host`.
