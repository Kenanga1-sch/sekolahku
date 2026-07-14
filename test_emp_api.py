import paramiko
import sys
import codecs
import json

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# Get employee IDs from DB
stdin, stdout, stderr = ssh.exec_command('sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "SELECT id, name FROM employee_details LIMIT 1;"')
db_out = stdout.read().decode().strip()
print("DB ROW:", db_out)

emp_id = db_out.split("|")[0] if db_out else ""
print("EMP ID:", emp_id)

if emp_id:
    # Now test the API endpoint for that specific employee
    stdin, stdout, stderr = ssh.exec_command(f'curl -s http://localhost:3000/api/master/employees/{emp_id}')
    api_out = stdout.read().decode()
    print("API RESPONSE:", api_out[:500])

# Also check deploy log progress
stdin, stdout, stderr = ssh.exec_command('tail -n 3 /home/kenanga/sekolahku/deploy.log')
print("DEPLOY LOG:", stdout.read().decode())

ssh.close()
