#!/bin/bash
set -e

HOST="100.97.52.50"
USER="kenanga"
PASS="20216609"
REMOTE_DIR="/home/kenanga/sekolahku-deploy"
LOCAL_DIR="/mnt/d/antigravity/sekolahku"

echo "=== Installing sshpass ==="
sudo apt-get update -qq
sudo apt-get install -y -qq sshpass rsync 2>/dev/null

echo "=== Syncing files to server ==="
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='.gocache' \
  --exclude='.gocache-*' \
  --exclude='.git' \
  --exclude='*.exe' \
  --exclude='sekolahku_linux' \
  --exclude='backups/' \
  --exclude='backup.bat' \
  --exclude='.claude/' \
  --exclude='.husky/' \
  --exclude='.vscode/' \
  --exclude='data/' \
  --exclude='uploads/' \
  --exclude='public/uploads/' \
  --exclude='tmp-*' \
  --exclude='*.log' \
  --exclude='deploy*.py' \
  --exclude='deploy*.sh' \
  --exclude='deploy-wsl.sh' \
  --exclude='.env*' \
  --exclude='scratch/' \
  --exclude='reports/' \
  -e "sshpass -p '$PASS' ssh -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR/" "$USER@$HOST:$REMOTE_DIR/"

echo "=== Rebuilding Docker containers ==="
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$USER@$HOST" "
  echo '$PASS' | sudo -S docker compose -f $REMOTE_DIR/docker-compose.yml down
  echo '$PASS' | sudo -S docker compose -f $REMOTE_DIR/docker-compose.yml up -d --build
"

echo "=== Deployment complete ==="
echo "App should be available at http://100.97.52.50:3000"
