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
    TELEGRAM_DATA_DIR="/home/chitchat/telegram-api-data"
    ;;
  dev)
    DEPLOY_DIR="/opt/sekolahku-dev"
    SERVICE="sekolahku-dev.service"
    PORT=3001
    ENV_FILE="/opt/sekolahku-dev/.env.dev"
    TELEGRAM_DATA_DIR="/home/chitchat/telegram-api-data"
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
# Snapshot konsisten via sqlite3 .backup bila tersedia (menyertakan WAL).
if [ -f "$DEPLOY_DIR/data/sekolahku.db" ]; then
  PRE_DEPLOY_DB="$DEPLOY_DIR/backups/pre-deploy.$(date +%Y%m%d_%H%M%S).db"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DEPLOY_DIR/data/sekolahku.db" ".backup '$PRE_DEPLOY_DB'"
  else
    cp "$DEPLOY_DIR/data/sekolahku.db" "$PRE_DEPLOY_DB"
  fi
  # Rotasi: simpan hanya PRE_DEPLOY_KEEP snapshot terbaru agar tidak menumpuk.
  PRE_DEPLOY_KEEP="${PRE_DEPLOY_KEEP:-7}"
  ls -1t "$DEPLOY_DIR/backups"/pre-deploy.*.db 2>/dev/null \
    | tail -n +$((PRE_DEPLOY_KEEP + 1)) | xargs -r rm -f
fi

# ── Copy artifacts hasil CI ───────────────
# Cari artifacts di workspace pipeline atau repo tempat CI berjalan.
find_artifact() {
  for CANDIDATE in "$@"; do
    [ -e "$CANDIDATE" ] && { echo "$(dirname "$CANDIDATE")"; return 0; }
  done
  return 1
}

SRC_ROOT="${SRC_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BINARY_DIR="$(find_artifact \
  "$SRC_ROOT/go-backend/sekolahku_linux" \
  "$SRC_ROOT/../go-backend/sekolahku_linux" \
  "$HOME/sekolahku/go-backend/sekolahku_linux")"
OUT_DIR="$(find_artifact \
  "$SRC_ROOT/out/index.html" \
  "$HOME/sekolahku/out/index.html")"

if [ -z "$BINARY_DIR" ] || [ -z "$OUT_DIR" ]; then
  echo "✗ FATAL: artifacts build tidak ditemukan!"
  echo "  Binary: ${BINARY_DIR:-<tidak ada>}  | out/: ${OUT_DIR:-<tidak ada>}"
  echo "  Jalankan scripts/ci.sh terlebih dahulu."
  exit 1
fi

echo "→ Artifacts: binary=$BINARY_DIR  out=$OUT_DIR"
cp "$BINARY_DIR/sekolahku_linux" "$DEPLOY_DIR/sekolahku_linux"
# Bersihkan dist lama sebelum salin: cp tanpa --delete meninggalkan halaman
# yang sudah dihapus dari repo (mis. /layanan/mutasi-keluar) tetap dilayani.
rm -rf "$DEPLOY_DIR/dist"
mkdir -p "$DEPLOY_DIR/dist"
cp -r "$OUT_DIR/." "$DEPLOY_DIR/dist/"
[ -f "$SRC_ROOT/Dockerfile" ] && cp "$SRC_ROOT/Dockerfile" "$DEPLOY_DIR/Dockerfile"
[ -f "$SRC_ROOT/docker-compose.yml" ] && cp "$SRC_ROOT/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"

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

# ── Jalankan container baru (hardened) ────
# Podman di sini ROOTLESS: uid 0 container ter-map ke uid host 1000, jadi
# "root" container = user biasa di host. Ditambah cap-drop + read-only,
# ruang ledak celah RCE ditekan seminimal mungkin.
echo "▶ Start container baru (cap-drop, no-new-privileges, read-only)..."
podman run -d --replace \
  --name "sekolahku-$MODE" \
  --restart unless-stopped \
  -p "$PORT:8181" \
  --env-file "$ENV_FILE" \
  -e PORT=8181 \
  -e ENV=production \
  -e TRUST_PROXY=true \
  --cap-drop=ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,size=64m,mode=1777 \
  -v "$DEPLOY_DIR/data:/app/data" \
  -v "$DEPLOY_DIR/public/uploads:/app/public/uploads" \
  -v "$DEPLOY_DIR/uploads:/app/uploads" \
  -v "$DEPLOY_DIR/dist:/app/dist" \
  $( [ -d "$TELEGRAM_DATA_DIR" ] && echo "-v $TELEGRAM_DATA_DIR:/app/telegram-data:ro" ) \
  "localhost/sekolahku-$MODE:latest"

# ── HEALTH CHECK (max 90 detik) ───────────
# Startup menjalankan sinkronisasi awal (Buku Induk dll.) SEBELUM server HTTP
# bind, sehingga pada data besar proses bisa >30 detik. Jendela 90 detik
# memberi ruang agar deploy tidak salah dianggap gagal.
echo "▶ Health check (max 90s)..."
HEALTH_OK=0
for i in $(seq 1 45); do
  sleep 2
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  echo "  attempt $i/45 — belum sehat, tunggu..."
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
