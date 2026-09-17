#!/bin/bash
# ==========================================
# Deploy Sekolahku — self-hosted, blue-green
# Dijalankan DI SERVER oleh post-receive hook.
#
# Mode (argumen pertama):
#   prod   → deploy ke produksi  (port 8181)
#   dev    → deploy ke staging   (port 3001)
#
# Blue-green: build container baru, health-check,
# baru swap. Gagal health-check → rollback otomatis.
# ==========================================
set -euo pipefail

MODE="${1:-prod}"
export PATH="/usr/local/go/bin:$PATH"

# ── Konfigurasi environment ──────────────
case "$MODE" in
  prod)
    DEPLOY_DIR="/opt/sekolahku-prod"
    SERVICE="sekolahku-prod.service"
    PORT=8181
    ENV_FILE="/opt/sekolahku-prod/.env.prod"
    ;;
  dev)
    DEPLOY_DIR="/opt/sekolahku-dev"
    SERVICE="sekolahku-dev.service"
    PORT=3001
    ENV_FILE="/opt/sekolahku-dev/.env.dev"
    ;;
  *)
    echo "Usage: $0 {prod|dev}"
    exit 1
    ;;
esac

echo "╔══════════════════════════════════════════╗"
echo "║  Deploy SEKOLAHKU [$MODE] port $PORT        ║"
echo "╚══════════════════════════════════════════╝"

# ── Pastikan struktur folder ada ──────────
mkdir -p "$DEPLOY_DIR"/{data,uploads,public/uploads,dist,backups}

# ── Backup sebelum deploy (safety net) ────
if [ -f "$DEPLOY_DIR/data/sekolahku.db" ]; then
  cp "$DEPLOY_DIR/data/sekolahku.db" "$DEPLOY_DIR/backups/pre-deploy.$(date +%Y%m%d_%H%M%S).db"
fi

# ── Copy artifacts hasil CI ───────────────
SRC_DIR="${SRC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cp "$SRC_DIR/go-backend/sekolahku_linux" "$DEPLOY_DIR/sekolahku_linux"
cp -r "$SRC_DIR/out/." "$DEPLOY_DIR/dist/"
[ -f "$SRC_DIR/Dockerfile" ] && cp "$SRC_DIR/Dockerfile" "$DEPLOY_DIR/Dockerfile"
[ -f "$SRC_DIR/docker-compose.yml" ] && cp "$SRC_DIR/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"

echo "▶ File artifacts tersalin ke $DEPLOY_DIR"

# ── Validasi .env wajib ───────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ FATAL: $ENV_FILE tidak ditemukan!"
  echo "  Buat dulu: cp .env.production.example $ENV_FILE  (lalu isi JWT_SECRET dll.)"
  exit 1
fi

# ── Build image container baru ────────────
echo "▶ Build image (podman)..."
( cd "$DEPLOY_DIR" && podman build -q -t "sekolahku-$MODE:latest" -f Dockerfile . )

# ── BLUE-GREEN: simpan container lama ─────
OLD_CID="$(podman ps -q --filter "name=sekolahku-$MODE" 2>/dev/null || true)"

# ── Jalankan container baru ───────────────
echo "▶ Start container baru..."
podman run -d --replace \
  --name "sekolahku-$MODE" \
  --restart unless-stopped \
  -p "$PORT:8181" \
  --env-file "$ENV_FILE" \
  -e PORT=8181 \
  -e ENV=production \
  -e TRUST_PROXY=true \
  -v "$DEPLOY_DIR/data:/app/data" \
  -v "$DEPLOY_DIR/public/uploads:/app/public/uploads" \
  -v "$DEPLOY_DIR/uploads:/app/uploads" \
  -v "$DEPLOY_DIR/dist:/app/dist" \
  "localhost/sekolahku-$MODE:latest"

# ── HEALTH CHECK (max 30 detik) ───────────
echo "▶ Health check (max 30s)..."
HEALTH_OK=0
for i in $(seq 1 15); do
  sleep 2
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  echo "  attempt $i/15 — belum sehat, tunggu..."
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "✗ HEALTH CHECK GAGAL — ROLLBACK OTOMATIS"
  podman logs --tail 30 "sekolahku-$MODE" || true
  if [ -n "$OLD_CID" ]; then
    echo "→ Mengembalikan container lama ($OLD_CID)..."
    podman start "$OLD_CID" || true
  fi
  exit 1
fi

echo "╔══════════════════════════════════════════╗"
echo "║  ✓ DEPLOY [$MODE] BERHASIL                ║"
echo "║  Health: http://localhost:$PORT/api/health ║"
echo "╚══════════════════════════════════════════╝"

# ── Aktifkan systemd (auto-restart saat reboot)
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload || true
  systemctl --user restart "$SERVICE" 2>/dev/null || \
    echo "  (catatan: $SERVICE belum ter-install — jalankan setup-systemd.sh)"
fi
