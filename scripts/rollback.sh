#!/bin/bash
# ==========================================
# Rollback — Sekolahku
# Kembalikan aplikasi ke kondisi backup terakhir.
# Usage: ./rollback.sh [prod|dev] [backup-arsip]
# ==========================================
set -euo pipefail

MODE="${1:-prod}"
case "$MODE" in
  prod) DEPLOY_DIR="/opt/sekolahku-prod"; PORT=8181 ;;
  dev)  DEPLOY_DIR="/opt/sekolahku-dev";  PORT=3001 ;;
  *) echo "Usage: $0 {prod|dev} [arsip-backup]"; exit 1 ;;
esac

BACKUP_DIR="$DEPLOY_DIR/backups"
CONTAINER="sekolahku-$MODE"

# Pilih arsip backup
if [ -n "${2:-}" ]; then
  ARCHIVE="$2"
else
  ARCHIVE="$(ls -t "$BACKUP_DIR"/sekolahku-$MODE-*.tar.gz 2>/dev/null | head -1)"
fi

if [ -z "${ARCHIVE:-}" ] || [ ! -f "$ARCHIVE" ]; then
  echo "✗ Tidak ada backup yang tersedia di $BACKUP_DIR"
  echo "  Backup dibuat otomatis sebelum setiap deploy & oleh backup.sh."
  exit 1
fi

echo "╔══════════════════════════════════════════╗"
echo "║  ROLLBACK [$MODE]                          ║"
echo "║  Arsip: $ARCHIVE"
echo "╚══════════════════════════════════════════╝"

# Snapshot kondisi saat ini (safety)
TS="$(date +%Y%m%d_%H%M%S)"
if [ -f "$DEPLOY_DIR/data/sekolahku.db" ]; then
  cp "$DEPLOY_DIR/data/sekolahku.db" "$BACKUP_DIR/pre-rollback-$TS.db"
  echo "✓ Snapshot kondisi saat ini: pre-rollback-$TS.db"
fi

# Hentikan container
echo "▸ Hentikan container $CONTAINER..."
podman stop "$CONTAINER" 2>/dev/null || true

# Restore dari arsip
echo "▸ Restore data dari arsip..."
tar -xzf "$ARCHIVE" -C "$DEPLOY_DIR"

# Jalankan ulang
echo "▸ Start container $CONTAINER..."
podman start "$CONTAINER"

# Health check
echo "▸ Health check..."
sleep 5
if curl -sf --max-time 10 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "╔══════════════════════════════════════════╗"
  echo "║  ✓ ROLLBACK BERHASIL — [$MODE] sehat kembali ║"
  echo "╚══════════════════════════════════════════╝"
  exit 0
else
  echo "✗ Rollback selesai tapi health check GAGAL."
  echo "  Log: podman logs --tail 50 $CONTAINER"
  exit 1
fi
