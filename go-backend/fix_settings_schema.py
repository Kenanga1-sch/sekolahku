import sqlite3

def add_columns():
    conn = sqlite3.connect('../data/sekolahku.db')
    cur = conn.cursor()
    columns_to_add = [
        "supervisor_name TEXT",
        "supervisor_nip TEXT",
        "landing_tagline TEXT",
        "landing_description TEXT",
        "landing_texts TEXT",
        "landing_sections TEXT"
    ]
    
    for col in columns_to_add:
        try:
            cur.execute(f"ALTER TABLE school_settings ADD COLUMN {col}")
            print(f"Added {col}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Column {col.split()[0]} already exists")
            else:
                print(f"Error adding {col}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == '__main__':
    add_columns()
