#!/bin/bash
# ==========================================
# Setup awal CI/CD self-hosted Sekolahku.
# Jalankan SEKALI di server fisik.
#
# Membuat:
#   1. Bare repo   : /opt/sekolahku.git
#   2. Deploy dirs : /opt/sekolahku-{prod,dev}
#   3. systemd     : sekolahku-{prod,dev}.service
#   4. post-receive hook (trigger pipeline)
# ==========================================
set -euo pipefail

BARE_REPO="/opt/sekolahku.git"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

echo "╔══════════════════════════════════════════╗"
echo "║  Setup CI/CD Self-Hosted — Sekolahku     ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Bare repo ──────────────────────────
echo "▸ [1/4] Buat bare repo: $BARE_REPO"
if [ ! -d "$BARE_REPO" ]; then
  git init --bare "$BARE_REPO"
else
  echo "  (sudah ada, skip)"
fi

# ── 2. Folder deploy terisolasi ───────────
echo "▸ [2/4] Buat folder deploy dev & prod"
for ENV in prod dev; do
  DIR="/opt/sekolahku-$ENV"
  mkdir -p "$DIR"/{data,uploads,public/uploads,dist,backups}
  echo "  ✓ $DIR"
done

# ── 3. systemd services ───────────────────
echo "▸ [3/4] Install systemd services"
mkdir -p "$HOME/.config/systemd/user"

for ENV in prod dev; do
  PORT=$([ "$ENV" = prod ] && echo 8181 || echo 3001)
  DIR="/opt/sekolahku-$ENV"

  cat > "$HOME/.config/systemd/user/sekolahku-$ENV.service" <<EOF
[Unit]
Description=Sekolahku $ENV (Podman container)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/podman start -a sekolahku-$ENV
ExecStop=/usr/bin/podman stop -t 10 sekolahku-$ENV
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  echo "  ✓ sekolahku-$ENV.service (port $PORT)"
done

systemctl --user daemon-reload
echo "  ✓ systemd daemon-reload"

# ── 4. post-receive hook ──────────────────
echo "▸ [4/4] Install post-receive hook"
HOOK="$BARE_REPO/hooks/post-receive"
cp "$REPO_DIR/scripts/post-receive" "$HOOK"
chmod +x "$HOOK"
echo "  ✓ $HOOK"

# ── Login persistence (systemd user) ──────
echo ""
echo "▸ Aktifkan lingering agar systemd user jalan tanpa login:"
echo "  sudo loginctl enable-linger $(whoami)"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✓ SETUP SELESAI                            ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Cara pakai:                                 ║"
echo "║  git remote add selfhost $BARE_REPO          ║"
echo "║  git push selfhost main                      ║"
echo "║  → Pipeline CI/CD jalan otomatis             ║"
echo "╚══════════════════════════════════════════════╝"
