import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
script = '''
import sqlite3
conn = sqlite3.connect('/home/kenanga/sekolahku/data/sekolahku.db')
cur = conn.cursor()
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_details'")
print(cur.fetchone()[0])
'''

sftp = ssh.open_sftp()
with sftp.file('/home/kenanga/sekolahku/check_emp.py', 'w') as f:
    f.write(script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /home/kenanga/sekolahku/check_emp.py')
print(stdout.read().decode())
