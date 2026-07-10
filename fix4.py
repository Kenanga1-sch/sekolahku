import sqlite3
import sys

def main():
    db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE alumni 
        SET graduation_year = '2025/2026', final_class = 'Kelas 6'
        WHERE status = 'graduated' AND (graduation_year IS NULL OR graduation_year = '')
    ''')
    
    count = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f'Fixed {count} records')

if __name__ == '__main__':
    main()
