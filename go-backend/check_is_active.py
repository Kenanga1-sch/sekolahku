import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT id, full_name, is_active FROM students WHERE is_active IS NULL")
rows = cur.fetchall()
print(f"Students with is_active NULL: {len(rows)}")
for row in rows[:5]:
    print(dict(row))
