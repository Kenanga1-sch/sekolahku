import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
stdin, stdout, stderr = ssh.exec_command('curl -s -i http://localhost:8181/api/public/school-settings')
print("CURL RESULT:", stdout.read().decode())
