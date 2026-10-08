#!/bin/bash
# ==========================================
# Health Check — Sekolahku
# Cek: aplikasi, database, static assets.
# Usage: ./health-check.sh [prod|dev]
# ==========================================
set -uo pipefail

MODE="${1:-prod}"
case "$MODE" in
  prod) PORT=8181; DB="/opt/sekolahku-prod/data/sekolahku.db" ;;
  dev)  PORT=3001; DB="/opt/sekolahku-dev/data/sekolahku.db" ;;
  *) echo "Usage: $0 {prod|dev}"; exit 1 ;;
esac

FAIL=0
check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $desc"
  else
    echo "  ✗ $desc"
    FAIL=1
  fi
}

echo "═══ Health Check [$MODE] — $(date '+%Y-%m-%d %H:%M:%S') ═══"

# 1. Aplikasi merespons
# Retry: health-check kadang berjalan di jeda transisi deploy (container baru
# baru saja bind) → curl sekali bisa false-negative walau detik kemudian sehat.
echo "▸ Aplikasi"
API_OK=0
for i in $(seq 1 5); do
  if curl -sf --max-time 5 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    API_OK=1
    break
  fi
  echo "  … percobaan $i/5 belum berhasil, tunggu 2s"
  sleep 2
done
if [ "$API_OK" -eq 1 ]; then
  echo "  ✓ API /api/health merespons (port $PORT)"
else
  echo "  ✗ API /api/health merespons (port $PORT)"
  FAIL=1
fi

# 2. Database
echo "▸ Database"
if [ -f "$DB" ]; then
  check "File DB ada: $DB" test -s "$DB"
  check "DB dapat dibaca (integrity check)" \
    sh -c "echo 'PRAGMA integrity_check;' | sqlite3 '$DB' | grep -q '^ok$'"
else
  echo "  ⚠ DB tidak ada: $DB (normal bila baru)"
fi

# 3. Static assets
echo "▸ Static assets"
check "Folder dist/ ada" test -d "/opt/sekolahku-$MODE/dist"
check "File index.html ada" test -f "/opt/sekolahku-$MODE/dist/index.html"

# 4. Container
echo "▸ Container"
check "Container sekolahku-$MODE berjalan" \
  podman ps --filter "name=sekolahku-$MODE" -q | grep -q .

# ── Ringkasan ─────────────────────────────
echo "═══════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "✓ SEMUA SEHAT — [$MODE] OK"
  exit 0
else
  echo "✗ ADA MASALAH — lihat log: podman logs --tail 50 sekolahku-$MODE"
  exit 1
fi
