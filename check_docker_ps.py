import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

stdin, stdout, stderr = ssh.exec_command('echo "20216609" | sudo -S docker ps --filter name=sekolahku-app')
print(stdout.read().decode())
