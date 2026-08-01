#!/bin/bash
echo "=== direct count ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT COUNT(*) AS total FROM students;" 2>&1 | grep -v password
echo "=== exit code test ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1
echo "=== user table schema ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db ".schema users" 2>&1 | grep -v password
