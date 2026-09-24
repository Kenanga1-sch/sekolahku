#!/bin/bash
# ==========================================
# podman-service-up.sh — start container Podman dengan aman (systemd ExecStart)
#
# Dipakai oleh unit systemd user (sekolahku-prod.service / sekolahku-dev.service).
#
# MASALAH yang diselesaikan:
#   Container Podman rootless bisa masuk "bad state": metadata bilang `running`
#   tetapi prosesnya sudah mati (conmon keluar prematur). `podman start` lalu
#   GAGAL permanen dengan exit 125:
#     failed to connect to container's attach socket: ... connection refused
#   / internal libpod error: conmon exited prematurely
#   Karena unit memakai Restart=always, kegagalan ini berubah menjadi crash-loop
#   tak berujung (ribuan restart) sampai operator turun tangan manual.
#
# CARA KERJA:
#   1. Jika container ada tapi statusnya tidak sehat (running tanpa pid hidup,
#      atau status aneh) → paksa hapus dulu.
#   2. Jika belum ada → buat ulang dengan `podman run` (konfigurasi hardening
#      identik dengan scripts/deploy.sh).
#   3. Jika sudah ada dan sehat → cukup `podman start -a`.
#   4. Jalankan `podman wait` supaya systemd tetap mengawasi proses container
#      (ExecStart blocking) sehingga Restart= selalu bereaksi saat container
#      benar-benar mati.
#
# Pemakaian: podman-service-up.sh <mode>   (prod|dev)
# ==========================================
set -uo pipefail

MODE="${1:-prod}"
export PATH="/usr/local/bin:/usr/bin:$PATH"

case "$MODE" in
  prod)
    DEPLOY_DIR="/opt/sekolahku-prod"
    NAME="sekolahku-prod"
    PORT=8181
    ENV_FILE="/opt/sekolahku-prod/.env.prod"
    TELEGRAM_DATA_DIR="/home/chitchat/telegram-api-data"
    ;;
  dev)
    DEPLOY_DIR="/opt/sekolahku-dev"
    NAME="sekolahku-dev"
    PORT=3001
    ENV_FILE="/opt/sekolahku-dev/.env.dev"
    TELEGRAM_DATA_DIR="/home/chitchat/telegram-api-data"
    ;;
  *)
    echo "Usage: $0 {prod|dev}" >&2
    exit 1
    ;;
esac

log() { echo "[podman-service-up:$MODE] $*" >&2; }

# ── Helper: apakah container benar-benar sehat? ────────────────────────────
# Sehat = ada di podman, status running, dan pid-nya hidup di host.
is_healthy_running() {
  podman inspect "$NAME" >/dev/null 2>&1 || return 1
  local status pid
  status="$(podman inspect "$NAME" --format '{{.State.Status}}' 2>/dev/null)" || return 1
  pid="$(podman inspect "$NAME" --format '{{.State.Pid}}' 2>/dev/null)" || return 1
  [ "$status" = "running" ] || return 1
  [ -n "$pid" ] && [ "$pid" != "0" ] && [ -d "/proc/$pid" ] || return 1
  return 0
}

# ── Bersihkan bad-state bila perlu ────────────────────────────────────────
if podman inspect "$NAME" >/dev/null 2>&1; then
  if is_healthy_running; then
    log "container sudah sehat & berjalan (pid $(podman inspect "$NAME" --format '{{.State.Pid}}'))"
  else
    log "container ada tetapi TIDAK sehat → paksa hapus (bad-state recovery)"
    podman rm -f "$NAME" >/dev/null 2>&1 || {
      # rm bisa gagal karena conmon internal error; coba lagi setelah jeda,
      # dan bersihkan sisa scope conmon bila masih membandel.
      log "rm pertama gagal, bersihkan sisa state lalu ulangi"
      sleep 1
      podman rm -f "$NAME" >/dev/null 2>&1 || {
        log "FATAL: gagal menghapus container bad-state '$NAME'"
        exit 125
      }
    }
    log "container bad-state berhasil dihapus"
  fi
fi

# ── Buat container bila belum ada (konfigurasi = deploy.sh) ───────────────
if ! podman container exists "$NAME" 2>/dev/null; then
  log "container belum ada → buat ulang dengan podman run"
  mkdir -p "$DEPLOY_DIR"/{data,uploads,public/uploads,dist}
  podman run -d \
    --name "$NAME" \
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
    "localhost/sekolahku-$MODE:latest" >/dev/null || {
      log "FATAL: podman run gagal"
      exit 125
    }
  log "container dibuat (port $PORT)"
fi

# ── Jalankan & awasi (blocking → systemd bisa restart saat mati) ──────────
# PENTING: jangan pakai `podman start -a` bila container SUDAH berjalan.
# Attach socket-nya bisa bentrok / sudah tidak valid → gagal walau container
# sehat. Karena `podman run -d --restart unless-stopped` sudah menyalakan
# container, cukup tunggu prosesnya (blocking) memakai `podman wait`.
if is_healthy_running; then
  log "container sudah berjalan, menunggu proses (podman wait)"
else
  log "men-start container"
  podman start "$NAME" >/dev/null 2>&1 || {
    log "FATAL: podman start gagal"
    exit 125
  }
fi

# Blocking sampai container berhenti; exit code diteruskan ke systemd agar
# Restart=on-failure bereaksi saat container benar-benar mati.
#
# CATATAN: `podman wait` mencetak exit code container ke stdout TETAPI proses
# podman-nya sendiri keluar 0. Kalau kita exec apa adanya, systemd melihat
# "sukses" dan TIDAK restart (bug yang membuat container mati bisa dibiarkan).
# Jadi tangkap exit code container dan teruskan sebagai exit code wrapper.
wait_rc=0
container_rc="$(podman wait "$NAME" 2>/dev/null)" || wait_rc=$?
if [ "$wait_rc" -ne 0 ]; then
  log "podman wait gagal (rc=$wait_rc)"
  exit "$wait_rc"
fi
container_rc="${container_rc:-0}"
# Normalisasi ke non-zero bila container keluar non-zero, agar on-failure
# memicu restart. Exit 0 tetap 0 (mis. stop terencana saat deploy).
log "container berhenti dengan exit code $container_rc"
if [ "$container_rc" != "0" ]; then
  exit "$container_rc"
fi
exit 0
