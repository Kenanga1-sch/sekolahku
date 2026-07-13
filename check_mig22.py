import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
time.sleep(20)

stdin, stdout, stderr = ssh.exec_command('echo "20216609" | sudo -S docker logs sekolahku-app 2>&1 | grep "Applying migration: 000022"')
print(stdout.read().decode())
