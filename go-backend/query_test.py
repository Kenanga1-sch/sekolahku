import sqlite3
import json

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

query = """
SELECT id, full_name, class_id, class_name, status 
FROM students 
WHERE 1=1 
AND (status = 'active' OR is_active = 1) 
AND (class_id = ? OR class_name = ? OR class_name = (SELECT name FROM student_classes WHERE id = ?))
LIMIT 100 OFFSET 0
"""
classId = 'hah1516t84ehrxvz97w6kdt0'

cur.execute(query, (classId, classId, classId))
rows = cur.fetchall()

print(f"Count: {len(rows)}")
print("Data:")
for row in rows:
    print(dict(row))
