#!/bin/bash
# ==========================================
# Deploy Sekolahku ke server produksi via Podman
# Target: kenanga@100.97.52.50
#
# Mode:
#   ./deploy.sh              → Full deploy (binary + frontend)
#   ./deploy.sh --frontend   → Frontend only (rsync out/ → restart)
#
# Melestarikan: data/sekolahku.db, uploads/, public/uploads/, .env
# ==========================================
set -euo pipefail

SERVER="kenanga@100.97.52.50"
SERVER_PASS="${DEPLOY_PASS:?DEPLOY_PASS wajib diisi (export DEPLOY_PASS=...)}"
DEPLOY_DIR="/home/kenanga/sekolahku-deploy"

SSH() { sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"; }
RSYNC() { sshpass -p "$SERVER_PASS" rsync -avz --progress -e "ssh -o StrictHostKeyChecking=no" "$@"; }

MODE="${1:-full}"

# ─────────────────────────────────────────
# Frontend-only mode: rsync out/ → restart
# ─────────────────────────────────────────
if [ "$MODE" = "--frontend" ]; then
  echo "=========================================="
  echo " [FRONTEND] Sinkronisasi out/ → server..."
  echo "=========================================="
  RSYNC --delete out/ "$SERVER:$DEPLOY_DIR/dist/"

  echo "=========================================="
  echo " [FRONTEND] Restart container..."
  echo "=========================================="
  SSH "cd $DEPLOY_DIR && podman restart sekolahku-app"

  echo "=========================================="
  echo " [FRONTEND] Health check..."
  echo "=========================================="
  sleep 5
  if SSH "curl -sf http://localhost:3000/api/health" >/dev/null 2>&1; then
    echo "OK — frontend deployed. Restart tanpa rebuild binary."
  else
    echo "GAGAL — log terakhir:"
    SSH "podman logs --tail 20 sekolahku-app" || true
    exit 1
  fi
  exit 0
fi

# ─────────────────────────────────────────
# Full deploy: binary + frontend
# ─────────────────────────────────────────
echo "=========================================="
echo " [0/5] Backup database produksi..."
echo "=========================================="
SSH "cp $DEPLOY_DIR/data/sekolahku.db $DEPLOY_DIR/data/sekolahku.db.bak.\$(date +%Y%m%d_%H%M%S) && ls -lh $DEPLOY_DIR/data/*.bak.* | tail -1"

echo "=========================================="
echo " [1/5] Sinkronisasi file ke server..."
echo "=========================================="
SSH "mkdir -p $DEPLOY_DIR/data $DEPLOY_DIR/public/uploads $DEPLOY_DIR/uploads $DEPLOY_DIR/dist"

RSYNC sekolahku_linux Dockerfile docker-compose.yml "$SERVER:$DEPLOY_DIR/"

echo "=========================================="
echo " [2/5] .env — mempertahankan yang lama..."
echo "=========================================="
SSH "test -f $DEPLOY_DIR/.env && echo '.env produksi dipertahankan' || { echo 'FATAL: .env tidak ditemukan'; exit 1; }"

echo "=========================================="
echo " [3/5] Build image di server..."
echo "=========================================="
SSH "cd $DEPLOY_DIR && podman build -t sekolahku-app:latest -f Dockerfile . 2>&1 | tail -3"

echo "=========================================="
echo " [4/5] Ganti container lama -> baru..."
echo "=========================================="
SSH "systemctl --user stop sekolahku-app.service 2>/dev/null || true"

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
  -v $DEPLOY_DIR/dist:/app/dist \
  localhost/sekolahku-app:latest"

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
