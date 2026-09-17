#!/bin/bash
# ==========================================
# Backup — Sekolahku
# Backup: database, uploads, static assets.
# Jalankan via cron setiap malam.
# Usage: ./backup.sh [prod|dev]
# ==========================================
set -euo pipefail

MODE="${1:-prod}"
case "$MODE" in
  prod) DEPLOY_DIR="/opt/sekolahku-prod" ;;
  dev)  DEPLOY_DIR="/opt/sekolahku-dev" ;;
  *) echo "Usage: $0 {prod|dev}"; exit 1 ;;
esac

BACKUP_DIR="$DEPLOY_DIR/backups"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TS="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="$BACKUP_DIR/sekolahku-$MODE-$TS.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "▸ Backup [$MODE] → $ARCHIVE"

# Snapshot DB konsisten (gunakan sqlite3 .backup jika ada)
if [ -f "$DEPLOY_DIR/data/sekolahku.db" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DEPLOY_DIR/data/sekolahku.db" ".backup '$BACKUP_DIR/db-$TS.db'"
  else
    cp "$DEPLOY_DIR/data/sekolahku.db" "$BACKUP_DIR/db-$TS.db"
  fi
fi

# Arsipkan semua
tar -czf "$ARCHIVE" \
  -C "$BACKUP_DIR" "db-$TS.db" 2>/dev/null || true
tar -czf "$ARCHIVE" \
  -C "$DEPLOY_DIR" data uploads public/uploads dist 2>/dev/null || true
rm -f "$BACKUP_DIR/db-$TS.db"

echo "  ✓ Backup tersimpan: $(du -h "$ARCHIVE" | cut -f1)"

# Rotasi: hapus backup >30 hari
OLD="$(find "$BACKUP_DIR" -name "sekolahku-*.tar.gz" -mtime +${RETENTION_DAYS})"
if [ -n "$OLD" ]; then
  echo "▸ Rotasi: hapus backup > ${RETENTION_DAYS} hari"
  echo "$OLD" | xargs rm -f
  echo "  ✓ Dihapus: $(echo "$OLD" | wc -l) file"
fi

echo "✓ Selesai."
