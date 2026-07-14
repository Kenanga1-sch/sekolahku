import paramiko
import sys
import codecs

# Override stdout encoding to prevent charmap errors on windows
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# Build and recreate
cmd = 'cd /home/kenanga/sekolahku && echo "20216609" | sudo -S docker compose build --no-cache && echo "20216609" | sudo -S docker compose up -d --force-recreate'

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
