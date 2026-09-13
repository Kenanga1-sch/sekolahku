#!/bin/bash
echo "=== students in container DB ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1 | grep -v password
echo "=== sample ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT full_name, class_name FROM students LIMIT 5;" 2>&1 | grep -v password
echo "=== classes ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT DISTINCT class_name FROM students WHERE class_name != '';" 2>&1 | grep -v password
echo "=== users ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT email, role FROM users;" 2>&1 | grep -v password
