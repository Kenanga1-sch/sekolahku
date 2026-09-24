#!/bin/bash
# ==========================================
# Backup — Sekolahku
# Backup lokal: database + uploads (TANPA dist — aset statis bisa dibangun
# ulang). Arsip DIENKRIPSI dan DITIMPA setiap malam sehingga hanya ada SATU
# file backup (penyimpanan lokal terbatas).
#
# Backup off-site (unlimited) ditangani oleh fitur "Backup Telegram" di app.
#
# Usage: ./backup.sh [prod|dev]
#
# Dekripsi manual bila perlu memulihkan:
#   openssl enc -d -aes-256-cbc -pbkdf2 -in <arsip>.enc -out backup.tar.gz
#   (masukkan password BACKUP_ZIP_PASSWORD saat diminta)
# ==========================================
set -euo pipefail

MODE="${1:-prod}"
case "$MODE" in
  prod)
    DEPLOY_DIR="/opt/sekolahku-prod"
    ENV_FILE="/opt/sekolahku-prod/.env.prod"
    ;;
  dev)
    DEPLOY_DIR="/opt/sekolahku-dev"
    ENV_FILE="/opt/sekolahku-dev/.env.dev"
    ;;
  *) echo "Usage: $0 {prod|dev}"; exit 1 ;;
esac

BACKUP_DIR="$DEPLOY_DIR/backups"
# Nama tetap → tiap run menimpa arsip sebelumnya (hanya 1 file backup lokal).
ARCHIVE="$BACKUP_DIR/sekolahku-$MODE-latest.tar.gz.enc"
WORK="$(mktemp -d "${BACKUP_DIR}/bkp-XXXXXX")"
STAGE="$WORK/stage"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

echo "▸ Backup [$MODE] → $ARCHIVE"

# ── Password enkripsi ─────────────────────
# Pakai BACKUP_ZIP_PASSWORD yang sama dengan backup Telegram. Baca dari env
# proses, atau dari .env deploy dir bila belum ada di environment.
PASS="${BACKUP_ZIP_PASSWORD:-}"
if [ -z "$PASS" ] && [ -f "$ENV_FILE" ]; then
  PASS="$(grep -aE '^BACKUP_ZIP_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
fi
if [ -z "$PASS" ]; then
  echo "✗ FATAL: BACKUP_ZIP_PASSWORD tidak diset — backup lokal TIDAK boleh plain." >&2
  exit 1
fi

# ── Kumpulkan isi backup ke STAGE ─────────
mkdir -p "$STAGE/data"

# Snapshot DB konsisten: sqlite3 .backup menyertakan isi WAL sehingga tidak
# kehilangan transaksi terbaru. Fallback cp mentah bila sqlite3 tidak ada.
if [ -f "$DEPLOY_DIR/data/sekolahku.db" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DEPLOY_DIR/data/sekolahku.db" ".backup '$STAGE/data/sekolahku.db'"
  else
    cp "$DEPLOY_DIR/data/sekolahku.db" "$STAGE/data/sekolahku.db"
  fi
fi

# uploads (legacy) + public/uploads. dist DIKECUALIKAN (bisa dibangun ulang).
for d in uploads public/uploads; do
  if [ -d "$DEPLOY_DIR/$d" ]; then
    mkdir -p "$STAGE/$(dirname "$d")"
    cp -a "$DEPLOY_DIR/$d" "$STAGE/$d"
  fi
done

# ── Arsip + enkripsi → timpa arsip lama ───
tar -czf "$WORK/final.tar.gz" -C "$STAGE" .
# Password lewat -pass env (bukan prompt): agar tidak muncul di daftar proses.
BACKUP_ZIP_PASSWORD="$PASS" openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass env:BACKUP_ZIP_PASSWORD \
  -in "$WORK/final.tar.gz" -out "$ARCHIVE"

echo "  ✓ Backup tersimpan: $(du -h "$ARCHIVE" | cut -f1) ($ARCHIVE)"

# ── Verifikasi: arsip bisa didekripsi & tar valid ──
if ! BACKUP_ZIP_PASSWORD="$PASS" openssl enc -d -aes-256-cbc -pbkdf2 \
       -pass env:BACKUP_ZIP_PASSWORD \
       -in "$ARCHIVE" 2>/dev/null | tar -tzf - >/dev/null 2>&1; then
  echo "✗ FATAL: verifikasi arsip backup GAGAL (enkripsi/tar rusak)" >&2
  exit 1
fi

echo "✓ Selesai (terenkripsi, ditimpa)."
