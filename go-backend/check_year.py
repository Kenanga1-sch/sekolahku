import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("academic_years:")
try:
    cur.execute("SELECT * FROM academic_years WHERE is_active = 1")
    print([dict(r) for r in cur.fetchall()])
except Exception as e:
    print("academic_years table error:", e)

print("school_settings:")
try:
    cur.execute("SELECT current_academic_year FROM school_settings LIMIT 1")
    print([dict(r) for r in cur.fetchall()])
except Exception as e:
    print("school_settings table error:", e)
