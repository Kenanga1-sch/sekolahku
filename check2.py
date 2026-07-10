import sqlite3
import sys

def main():
    db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT a.id, a.full_name, a.graduation_year, a.final_class, a.status 
        FROM students s
        JOIN alumni a ON s.id = a.student_id
        WHERE s.status = 'graduated'
        LIMIT 5
    ''')
    for r in cursor.fetchall():
        print('ALUMNI FOR GRADUATED:', r)
        
    conn.close()

if __name__ == '__main__':
    main()
