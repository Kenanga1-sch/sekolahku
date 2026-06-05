import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')
stdin, stdout, stderr = ssh.exec_command('cd /home/kenanga/sekolahku-deploy && sudo -S sh -c "docker compose down && docker compose up -d --build"')
stdin.write('20216609\n')
stdin.flush()
print(stdout.read().decode())
print(stderr.read().decode())
