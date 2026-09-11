#!/bin/bash
# ==========================================
# Deploy Sekolahku ke server produksi via Podman
# Target: kenanga@100.97.52.50
#
# Melestarikan: data/sekolahku.db, uploads/, public/uploads/, .env
# Container lama: host-network port 3000 — diganti bridge port 8181.
# ==========================================
set -euo pipefail

SERVER="kenanga@100.97.52.50"
SERVER_PASS="${DEPLOY_PASS:-20216609}"
DEPLOY_DIR="/home/kenanga/sekolahku-deploy"

SSH() { sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"; }
RSYNC() { sshpass -p "$SERVER_PASS" rsync -avz --progress -e "ssh -o StrictHostKeyChecking=no" "$@"; }

echo "=========================================="
echo " [0/5] Backup database produksi..."
echo "=========================================="
SSH "cp $DEPLOY_DIR/data/sekolahku.db $DEPLOY_DIR/data/sekolahku.db.bak.\$(date +%Y%m%d_%H%M%S) && ls -lh $DEPLOY_DIR/data/*.bak.* | tail -1"

echo "=========================================="
echo " [1/5] Sinkronisasi file ke server..."
echo "=========================================="
SSH "mkdir -p $DEPLOY_DIR/data $DEPLOY_DIR/public/uploads $DEPLOY_DIR/uploads"

RSYNC sekolahku_linux Dockerfile docker-compose.yml "$SERVER:$DEPLOY_DIR/"

echo "=========================================="
echo " [2/5] .env — mempertahankan yang lama..."
echo "=========================================="
# .env lama berisi JWT_SECRET + GEMINI_API_KEY + TELEGRAM_* milik produksi.
# Jangan ditimpa; hanya pastikan COOKIE_SECURE=true & EXTRA_ALLOWED_ORIGINS ada.
SSH "test -f $DEPLOY_DIR/.env && echo '.env produksi dipertahankan' || { echo 'FATAL: .env tidak ditemukan'; exit 1; }"

echo "=========================================="
echo " [3/5] Build image di server..."
echo "=========================================="
SSH "cd $DEPLOY_DIR && podman build -t sekolahku-app:latest -f Dockerfile . 2>&1 | tail -3"

echo "=========================================="
echo " [4/5] Ganti container lama -> baru..."
echo "=========================================="
# Hentikan systemd user service dulu agar tidak otomatis me-restart
# container lama di tengah penggantian (race --restart unless-stopped).
SSH "systemctl --user stop sekolahku-app.service 2>/dev/null || true"

# Container baru: bridge network. Host port 3000 = yang dituju Cloudflare
# Tunnel (jangan diubah tanpa update konfigurasi tunnel di dasbor Cloudflare).
# TRUST_PROXY=true karena HTTPS dihentikan di Cloudflare edge — tanpa ini
# middleware HTTPSRedirect mengirim 301 ke https://localhost yang salah.
# --replace otomatis membuang container lama yang memakai nama sama.
SSH "cd $DEPLOY_DIR && podman run -d \
  --replace \
  --name sekolahku-app \
  --restart unless-stopped \
  -p 3000:8181 \
  --env-file $DEPLOY_DIR/.env \
  -e PORT=8181 \
  -e ENV=production \
  -e TRUST_PROXY=true \
  -v $DEPLOY_DIR/data:/app/data \
  -v $DEPLOY_DIR/public/uploads:/app/public/uploads \
  -v $DEPLOY_DIR/uploads:/app/uploads \
  localhost/sekolahku-app:latest"

# Nyalakan kembali service agar systemd tetap mengelola container baru.
SSH "systemctl --user start sekolahku-app.service 2>/dev/null || true"

echo "=========================================="
echo " [5/5] Health check..."
echo "=========================================="
sleep 8
if SSH "curl -sf http://localhost:3000/api/health" >/dev/null 2>&1; then
  echo "OK — health check lulus. Deploy sukses."
  echo "Verifikasi publik: https://sdn1kenanga.sch.id/api/health"
else
  echo "GAGAL — 30 baris log terakhir:"
  SSH "podman logs --tail 30 sekolahku-app" || true
  exit 1
fi
