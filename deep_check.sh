#!/bin/bash
echo "=== /app/data/sekolahku.db tables ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db ".tables" 2>&1 | grep -v password | head -5
echo "=== host /app/data/sekolahku.db ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S sqlite3 /app/data/sekolahku.db ".tables" 2>&1 | grep -v password | head -5
echo "=== counts host ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S sqlite3 /app/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1 | grep -v password
echo "=== diff: is it same file? ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S md5sum /app/data/sekolahku.db /app/sekolahku.db 2>&1 | grep -v password
echo "=== mount check ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker inspect sekolahku-app --format '{{json .Mounts}}' 2>&1 | grep -v password
