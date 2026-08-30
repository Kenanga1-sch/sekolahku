import sqlite3

conn = sqlite3.connect('data/sekolahku.db')
cursor = conn.cursor()
cursor.execute("UPDATE school_settings SET public_theme = 'neo-brutalism'")
conn.commit()
conn.close()
print("Tema di DB berhasil diubah ke neo-brutalism!")
