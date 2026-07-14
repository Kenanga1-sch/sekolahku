import paramiko
import sys
import codecs
import json

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# 1. Check if deploy finished
print("=== DEPLOY LOG (last 5 lines) ===")
stdin, stdout, stderr = ssh.exec_command('tail -n 5 /home/kenanga/sekolahku/deploy.log')
print(stdout.read().decode())

# 2. Check docker status
print("=== DOCKER PS ===")
stdin, stdout, stderr = ssh.exec_command('echo "20216609" | sudo -S docker ps --format "{{.Names}} {{.Status}} {{.CreatedAt}}"')
print(stdout.read().decode())

# 3. Check git log on server
print("=== GIT LOG ===")
stdin, stdout, stderr = ssh.exec_command('cd /home/kenanga/sekolahku && git log --oneline -3')
print(stdout.read().decode())

# 4. Query DB directly for employee data
print("=== DB EMPLOYEE DATA (first 2) ===")
stdin, stdout, stderr = ssh.exec_command("sqlite3 /home/kenanga/sekolahku/data/sekolahku.db \"SELECT id, name, phone FROM employee_details LIMIT 2;\"")
print(stdout.read().decode())
print(stderr.read().decode())

# 5. Check DB schema
print("=== DB SCHEMA ===")
stdin, stdout, stderr = ssh.exec_command("sqlite3 /home/kenanga/sekolahku/data/sekolahku.db \".schema employee_details\"")
print(stdout.read().decode())

ssh.close()
