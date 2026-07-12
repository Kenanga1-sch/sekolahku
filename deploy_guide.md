# Panduan Deployment (Sekolahku)

Dokumen ini berisi panduan singkat untuk melakukan deployment dan update aplikasi ke server produksi.

## 1. Alur Update Aplikasi (GitHub Workflow)

Setiap kali Anda selesai melakukan perubahan pada kode (termasuk fitur baru atau perbaikan bug), ikuti langkah ini untuk melakukan deployment:

### Langkah A: Commit & Push dari Komputer Lokal
Pastikan semua perubahan sudah disimpan. Buka terminal di folder project Anda, lalu jalankan:
```bash
git add .
git commit -m "Pesan update Anda di sini"
git push origin main
```

### Langkah B: Pull & Build di Server
Setelah kode berhasil di-push ke GitHub, masuk ke server produksi melalui SSH, lalu jalankan perintah berikut untuk mengambil update terbaru dan me-rebuild aplikasi:
```bash
# 1. Masuk ke direktori aplikasi
cd /home/kenanga/sekolahku

# 2. Ambil pembaruan terbaru dari GitHub
git pull origin main

# 3. Build ulang menggunakan Docker Compose
sudo docker compose down
sudo docker compose up -d --build
```
Proses build ini biasanya memakan waktu beberapa menit. Setelah selesai, aplikasi versi terbaru akan langsung berjalan.

---

## 2. Struktur Deployment Docker

Aplikasi ini menggunakan `docker-compose` untuk mengatur environment produksi, dengan batasan memori yang sudah disesuaikan untuk spesifikasi server:
- **Next.js App**: ~512MB RAM
- **PocketBase / SQLite**: ~256MB RAM

## 3. Catatan Penting
- Pastikan Anda berada di _branch_ `main` saat melakukan `git pull`.
- Jika terjadi perubahan pada file konfigurasi `.env`, pastikan Anda juga memperbaruinya secara manual di server (karena file `.env` biasanya tidak di-commit ke GitHub).
- Dokumentasi konfigurasi server lebih lengkap (termasuk tuning memori, NGINX, SSL) dapat dilihat di `docs/LOW-SPEC-DEPLOYMENT.md`.
