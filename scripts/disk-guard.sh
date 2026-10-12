#!/bin/bash
# ==========================================
# disk-guard.sh — pantau & jaga ruang disk host
#
# Dipanggil manual atau via cron (mis. tiap 6 jam).
# Bila pemakaian disk melewati AMBANG, bersihkan kandidat aman:
#   - image Podman/Docker yang tidak dipakai container (-a)
#   - build cache Go (dibangun ulang otomatis)
#   - cicd.log lama (rotate)
#   - build-work stale di /opt/sekolahku-work (out/, dist/, .next/)
#
# Aman: TIDAK menyentuh data produksi (.env, data/, uploads/, dist/),
# state aplikasi, image yang sedang dipakai container, atau node_modules
# yang dipakai pipeline. Hanya membersihkan ARTEFAK yang bisa dibangun ulang.
#
# Env:
#   DISK_PATH     titik mount yang dipantau   (default /)
#   DISK_THRESHOLD persen ambang pembersihan  (default 85)
#   DRY_RUN=1     hanya laporkan, tidak menghapus
# ==========================================
set -uo pipefail

DISK_PATH="${DISK_PATH:-/}"
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[disk-guard] $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Pemakaian disk (angka bulat tanpa "%") untuk mount DISK_PATH.
USE_PCT=$(df -P "$DISK_PATH" | awk 'NR==2 {gsub("%","",$5); print $5}')

log "pemakaian disk $DISK_PATH = ${USE_PCT}% (ambang ${DISK_THRESHOLD}%)"

if [ "${USE_PCT:-0}" -lt "$DISK_THRESHOLD" ]; then
  log "di bawah ambang — tidak ada tindakan."
  exit 0
fi

log "MELEWATI AMBANG — mulai pembersihan${DRY_RUN:+ (DRY_RUN=$DRY_RUN)}"

BEFORE=$(df -P "$DISK_PATH" | awk 'NR==2 {print $4}')

# ── 1. Image Podman yang tidak dipakai container ──
if command -v podman >/dev/null 2>&1; then
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] podman image prune -a -f"
  else
    log "podman image prune -a -f"
    podman image prune -a -f >/dev/null 2>&1 || true
  fi
fi

# ── 2. Image & build cache Docker yang tidak dipakai container ──
if command -v docker >/dev/null 2>&1; then
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] docker builder prune -a -f"
    log "[dry-run] docker image prune -a -f"
  else
    # Build cache bisa menumpuk puluhan GB (pernah ~50 GB). Aman: dibangun
    # ulang saat build. `image prune -a` hanya hapus image tanpa container.
    log "docker builder prune -a -f"
    docker builder prune -a -f >/dev/null 2>&1 || true
    log "docker image prune -a -f"
    docker image prune -a -f >/dev/null 2>&1 || true
  fi
fi

# ── 3. Build cache Go (aman, dibangun ulang saat build) ──
export PATH="/usr/local/go/bin:$PATH"
if command -v go >/dev/null 2>&1; then
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] go clean -cache"
  else
    log "go clean -cache"
    go clean -cache >/dev/null 2>&1 || true
  fi
fi

# ── 4. Rotasi cicd.log bila besar ──
CICD_LOG="/opt/sekolahku-prod/backups/cicd.log"
if [ -f "$CICD_LOG" ]; then
  SIZE=$(stat -c%s "$CICD_LOG" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 5242880 ]; then
    if [ "$DRY_RUN" = "1" ]; then
      log "[dry-run] rotate $CICD_LOG (${SIZE} bytes)"
    else
      log "rotate $CICD_LOG (${SIZE} bytes)"
      mv -f "$CICD_LOG" "$CICD_LOG.1"
    fi
  fi
fi

# ── 5. Artefak build sementara di work-tree (dibangun ulang tiap deploy) ──
WORK_DIR="/opt/sekolahku-work"
for sub in out .next; do
  if [ -d "$WORK_DIR/$sub" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      log "[dry-run] rm -rf $WORK_DIR/$sub ($(du -sh "$WORK_DIR/$sub" 2>/dev/null | cut -f1))"
    else
      log "rm -rf $WORK_DIR/$sub"
      rm -rf "$WORK_DIR/$sub"
    fi
  fi
done

# ── 6. Log npm lama (> 30 hari) ──
if [ -d "$HOME/.npm/_logs" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] hapus log npm >30 hari"
  else
    find "$HOME/.npm/_logs" -type f -mtime +30 -delete 2>/dev/null || true
  fi
fi

AFTER=$(df -P "$DISK_PATH" | awk 'NR==2 {print $4}')
NEW_PCT=$(df -P "$DISK_PATH" | awk 'NR==2 {gsub("%","",$5); print $5}')
log "selesai — disk $DISK_PATH: ${USE_PCT}% → ${NEW_PCT}% (tersedia ${BEFORE}KB → ${AFTER}KB)"

# Peringatan bila masih di atas ambang setelah dibersihkan.
if [ "${NEW_PCT:-0}" -ge "$DISK_THRESHOLD" ]; then
  log "PERINGATAN: disk masih ${NEW_PCT}% ≥ ${DISK_THRESHOLD}% setelah dibersihkan. Perlu intervensi manual."
  exit 2
fi

exit 0
