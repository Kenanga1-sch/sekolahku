import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
sql = 'ALTER TABLE employee_details ADD COLUMN phone TEXT;'
cmd = f'''sqlite3 /home/kenanga/sekolahku/data/sekolahku.db "{sql}"'''
stdin, stdout, stderr = ssh.exec_command(cmd)
print("OUT:", stdout.read().decode())
print("ERR:", stderr.read().decode())
