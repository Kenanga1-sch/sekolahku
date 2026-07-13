import sqlite3

conn = sqlite3.connect('../data/sekolahku.db')
cur = conn.cursor()
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='students'")
print(cur.fetchone()[0])
