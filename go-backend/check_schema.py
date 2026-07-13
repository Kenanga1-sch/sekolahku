import sqlite3

conn = sqlite3.connect('d:/antigravity/sekolahku/go-backend/data/sekolahku.db')
cur = conn.cursor()
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_details'")
print(cur.fetchone()[0])
conn.close()
