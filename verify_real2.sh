#!/bin/bash
echo "=== direct count ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT COUNT(*) AS total FROM students;" 2>&1 | grep -v password
echo "=== exit code test ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1
echo "=== user table schema ==="
echo "${SUDO_PASS:?SUDO_PASS wajib diisi}" | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db ".schema users" 2>&1 | grep -v password
