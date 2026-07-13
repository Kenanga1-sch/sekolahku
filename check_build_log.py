import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

stdin, stdout, stderr = ssh.exec_command('cat /home/kenanga/sekolahku/build.log')
print(stdout.read().decode())
print(stderr.read().decode())
