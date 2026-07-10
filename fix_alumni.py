import sqlite3
import sys

def main():
    if len(sys.argv) < 2:
        print('Usage: python3 fix_alumni.py <db_path>')
        sys.exit(1)
    db_path = sys.argv[1]
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, student_id FROM alumni 
        WHERE status = 'graduated' AND (graduation_year IS NULL OR graduation_year = '')
    ''')
    rows = cursor.fetchall()
    
    count = 0
    for row in rows:
        alumni_id, student_id = row
        if not student_id: continue
        
        cursor.execute('''
            SELECT academic_year, class_name FROM student_class_history 
            WHERE student_id = ? AND status = 'graduated' 
            ORDER BY record_date DESC LIMIT 1
        ''', (student_id,))
        hist = cursor.fetchone()
        
        if hist and hist[0]:
            grad_year = hist[0]
            class_name = hist[1]
            
            cursor.execute('''
                UPDATE alumni 
                SET graduation_year = ?, final_class = ? 
                WHERE id = ?
            ''', (grad_year, class_name, alumni_id))
            count += 1
            
    conn.commit()
    conn.close()
    print(f'Fixed {count} graduated alumni records')

if __name__ == '__main__':
    main()
