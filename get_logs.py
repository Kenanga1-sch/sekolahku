import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
stdin, stdout, stderr = ssh.exec_command('echo "20216609" | sudo -S docker logs sekolahku-app | head -n 100')
text = stdout.read().decode('utf-8', errors='replace')
print(text.encode('ascii', errors='replace').decode('ascii'))
