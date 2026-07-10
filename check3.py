import sqlite3
import sys

def main():
    db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT academic_year, class_name, status 
        FROM student_class_history 
        WHERE student_id = 'h8e50mou5eucjwnf8xfjp8e8'
    ''')
    for r in cursor.fetchall():
        print('HISTORY:', r)
        
    conn.close()

if __name__ == '__main__':
    main()
