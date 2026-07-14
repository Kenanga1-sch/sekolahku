import paramiko
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# Add the missing phone column
cmd = "sqlite3 /home/kenanga/sekolahku/data/sekolahku.db \"ALTER TABLE employee_details ADD COLUMN phone TEXT;\""
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode()
err = stderr.read().decode()
print("ADD COLUMN stdout:", out)
print("ADD COLUMN stderr:", err)

# Verify
cmd2 = "sqlite3 /home/kenanga/sekolahku/data/sekolahku.db \"PRAGMA table_info(employee_details);\""
stdin, stdout, stderr = ssh.exec_command(cmd2)
print("=== SCHEMA AFTER ===")
print(stdout.read().decode())

ssh.close()
