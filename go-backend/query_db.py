import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get 5 active students
cur.execute("SELECT id, full_name, class_id, class_name, status FROM students WHERE status='active' LIMIT 5")
print("Students:")
for row in cur.fetchall():
    print(dict(row))

print("\nClasses:")
cur.execute("SELECT id, name FROM student_classes LIMIT 5")
for row in cur.fetchall():
    print(dict(row))
