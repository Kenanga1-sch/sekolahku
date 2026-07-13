import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("""
SELECT class_name, class_id, COUNT(*) as count 
FROM students 
WHERE status = 'active' OR is_active = 1 
GROUP BY class_name, class_id
""")
print("Students per class:")
for row in cur.fetchall():
    print(dict(row))
