#!/bin/bash
echo "=== verify students count in real DB ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT COUNT(*) FROM students;" 2>&1 | grep -v password
echo "=== classes ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL;" 2>&1 | grep -v password
echo "=== migration check (does it have must_change_password?) ==="
echo '20216609' | sudo -S sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "PRAGMA table_info(users);" 2>&1 | grep -v password | grep -i password
