import sqlite3
import sys

def main():
    if len(sys.argv) < 2:
        print('Usage: python3 check.py <db_path>')
        sys.exit(1)
    db_path = sys.argv[1]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, full_name, graduation_year, final_class, status 
        FROM alumni 
        LIMIT 5
    ''')
    for r in cursor.fetchall():
        print("ALUMNI:", r)
        
    cursor.execute('''
        SELECT id, full_name, class_name, status, is_active 
        FROM students 
        WHERE status = 'graduated'
        LIMIT 5
    ''')
    for r in cursor.fetchall():
        print("STUDENT GRADUATED:", r)

    conn.close()

if __name__ == '__main__':
    main()
