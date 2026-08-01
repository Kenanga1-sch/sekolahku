#!/bin/bash
echo "=== verify container DB now ==="
echo '20216609' | sudo -S docker exec sekolahku-app ls -la /app/data/ 2>&1 | grep -v password
echo "=== students count ==="
echo '20216609' | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1 | grep -v password
echo "=== users ==="
echo '20216609' | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT email, role FROM users;" 2>&1 | grep -v password
echo "=== sample students ==="
echo '20216609' | sudo -S docker exec sekolahku-app sqlite3 /app/data/sekolahku.db "SELECT full_name, class_name FROM students LIMIT 3;" 2>&1 | grep -v password
