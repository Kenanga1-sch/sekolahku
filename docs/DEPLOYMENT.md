# 🚀 Panduan Deployment — Sekolahku (Self-Hosted CI/CD)

CI/CD **100% self-hosted, gratis, tanpa pihak ketiga** (tidak menggunakan GitHub Actions, tidak ada layanan berbayar).

## Arsitektur

```
Developer (git push main)
        ↓
  Bare repo: /opt/sekolahku.git
        ↓
  hooks/post-receive  (trigger otomatis)
        ↓
  ┌──────────── PIPELINE ────────────┐
  │ 1. ci.sh:  lint + typecheck      │  ← GAGAL? tolak push
  │            + unit test + build   │
  │ 2. deploy ke STAGING (port 3001) │
  │ 3. health-check staging          │  ← GAGAL? berhenti
  │ 4. promote ke PRODUKSI (8181)    │  ← blue-green
  │ 5. health-check produksi         │  ← GAGAL? rollback
  └──────────────────────────────────┘
```

## Isolasi Environment (satu server fisik)

|            | Staging/Dev                   | Produksi                      |
| ---------- | ----------------------------- | ----------------------------- |
| Folder     | `/opt/sekolahku-dev`          | `/opt/sekolahku-prod`         |
| Port       | 3001                          | 8181                          |
| Database   | `data/sekolahku.db` (sendiri) | `data/sekolahku.db` (sendiri) |
| `.env`     | `.env.dev`                    | `.env.prod`                   |
| Container  | `sekolahku-dev`               | `sekolahku-prod`              |
| systemd    | `sekolahku-dev.service`       | `sekolahku-prod.service`      |
| Cloudflare | —                             | `sdn1kenanga.sch.id`          |

## Setup Awal (jalankan sekali di server)

```bash
# 1. Jalankan setup script
bash scripts/setup-cicd.sh

# 2. Aktifkan systemd user (agar jalan tanpa login manual)
sudo loginctl enable-linger $(whoami)

# 3. Tambahkan remote self-hosted
git remote add selfhost /opt/sekolahku.git
```

## Konfigurasi `.env` (wajib sebelum deploy pertama)

```bash
# Produksi
cp .env.production.example /opt/sekolahku-prod/.env.prod
nano /opt/sekolahku-prod/.env.prod    # isi JWT_SECRET, dll.

# Staging
cp .env.production.example /opt/sekolahku-dev/.env.dev
nano /opt/sekolahku-dev/.env.dev      # JWT_SECRET berbeda!
```

> ⚠️ **Penting:** JWT_SECRET staging & produksi **harus berbeda**.

## Penggunaan Sehari-hari

### Deploy ke produksi (otomatis)

```bash
git push selfhost main
# → CI jalan → staging → health check → produksi → health check
```

### Test saja (tanpa deploy)

```bash
git push selfhost <branch-lain>
# → CI jalan (lint+test+build), tidak ada deploy
```

### Cek status pipeline

```bash
tail -f /opt/sekolahku-prod/backups/cicd.log
```

## Operasional

| Aksi                        | Perintah                        |
| --------------------------- | ------------------------------- |
| Cek kesehatan prod          | `scripts/health-check.sh prod`  |
| Cek kesehatan staging       | `scripts/health-check.sh dev`   |
| Backup manual               | `scripts/backup.sh prod`        |
| Rollback ke backup terakhir | `scripts/rollback.sh prod`      |
| Lihat log container         | `podman logs -f sekolahku-prod` |
| Restart container           | `podman restart sekolahku-prod` |

### Backup otomatis (cron)

```bash
# Backup tiap malam jam 02:00
crontab -e
0 2 * * * /home/chitchat/sekolahku/scripts/backup.sh prod >> /opt/sekolahku-prod/backups/backup.log 2>&1
```

## Rollback (saat produksi bermasalah)

```bash
# Kembali ke backup terakhir (otomatis dibuat sebelum setiap deploy)
scripts/rollback.sh prod

# Atau pilih arsip spesifik
scripts/rollback.sh prod /opt/sekolahku-prod/backups/sekolahku-prod-20260101_120000.tar.gz
```

## Keamanan

- ✅ Tidak ada layanan pihak ketiga (GitHub Actions, Snyk, dll.)
- ✅ Tidak ada hardcoded password di script
- ✅ `.env` tidak masuk git (ada di `.gitignore`)
- ✅ Deploy hanya dari branch `main` yang sudah lulus CI
- ✅ Blue-green deployment: produksi lama dipertahankan sampai container baru sehat

## Troubleshooting

**CI gagal di ESLint/typecheck**
→ Perbaiki kode di branch, push ulang. Lihat log: `tail -50 /opt/sekolahku-prod/backups/cicd.log`

**Deploy staging gagal health check**
→ Produksi **tidak** terkena. Cek: `podman logs --tail 50 sekolahku-dev`

**Produksi gagal setelah deploy**
→ Rollback otomatis berjalan. Jika masih bermasalah: `scripts/rollback.sh prod`

**Container tidak start setelah reboot**
→ Pastikan lingering aktif: `loginctl enable-linger $(whoami)`
