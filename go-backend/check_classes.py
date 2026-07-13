import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("Classes:")
cur.execute("SELECT id, name, academic_year, is_active FROM student_classes")
for row in cur.fetchall():
    print(dict(row))
