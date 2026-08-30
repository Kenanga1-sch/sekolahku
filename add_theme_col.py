import sqlite3

conn = sqlite3.connect('data/sekolahku.db')
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE school_settings ADD COLUMN public_theme TEXT DEFAULT 'default-original'")
    conn.commit()
    print("Kolom public_theme berhasil ditambahkan!")
except Exception as e:
    print("Error:", e)
conn.close()
