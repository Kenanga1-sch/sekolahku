import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

script = """
import sqlite3
def add_columns():
    conn = sqlite3.connect('/home/kenanga/sekolahku/data/sekolahku.db')
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
        except Exception as e:
            print(f"Error adding {col}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == '__main__':
    add_columns()
"""

sftp = ssh.open_sftp()
with sftp.file('/home/kenanga/sekolahku/fix_db_host.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /home/kenanga/sekolahku/fix_db_host.py')
print("STDOUT:", stdout.read().decode())
print("STDERR:", stderr.read().decode())

# Then restart the docker container
stdin, stdout, stderr = ssh.exec_command('echo "20216609" | sudo -S docker restart sekolahku-app')
print("RESTART:", stdout.read().decode())
