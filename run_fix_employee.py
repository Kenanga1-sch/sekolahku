import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

script = """
import sqlite3

db_path = '/home/kenanga/sekolahku/data/sekolahku.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

try:
    # Disable foreign keys temporarily
    cur.execute("PRAGMA foreign_keys=off;")
    
    # Check if user_id is NOT NULL
    cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_details'")
    schema = cur.fetchone()[0]
    
    if 'user_id TEXT NOT NULL' in schema:
        print('Fixing employee_details NOT NULL constraint...')
        conn.execute("BEGIN TRANSACTION;")
        
        cur.execute('''
        CREATE TABLE employee_details_new (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            nip TEXT,
            nuptk TEXT,
            nik TEXT,
            employment_status TEXT,
            job_type TEXT,
            join_date TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            category TEXT, 
            degree TEXT, 
            quote TEXT, 
            photo_url TEXT, 
            display_order INTEGER DEFAULT 0, 
            name_without_degree TEXT, 
            name TEXT, 
            email TEXT, 
            role TEXT DEFAULT 'guru',
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        ''')
        
        cur.execute('''
        INSERT INTO employee_details_new (id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at, category, degree, quote, photo_url, display_order, name_without_degree, name, email, role)
        SELECT id, user_id, nip, nuptk, nik, employment_status, job_type, join_date, created_at, updated_at, category, degree, quote, photo_url, display_order, name_without_degree, name, email, role 
        FROM employee_details;
        ''')
        
        cur.execute("DROP TABLE employee_details;")
        cur.execute("ALTER TABLE employee_details_new RENAME TO employee_details;")
        
        conn.commit()
        print('Fix applied successfully.')
    else:
        print('employee_details user_id is already nullable.')
        
except Exception as e:
    conn.rollback()
    print('Error applying fix:', str(e))
finally:
    cur.execute("PRAGMA foreign_keys=on;")
    conn.close()
"""

sftp = ssh.open_sftp()
with sftp.file('/home/kenanga/sekolahku/fix_employee_details.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /home/kenanga/sekolahku/fix_employee_details.py')
print(stdout.read().decode())
if stderr.read():
    print("ERR:", stderr.read().decode())
