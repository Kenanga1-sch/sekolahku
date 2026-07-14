import paramiko
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

cmd = 'cd /home/kenanga/sekolahku && git pull && echo "20216609" | sudo -S docker compose build --no-cache && echo "20216609" | sudo -S docker compose up -d --force-recreate'

stdin, stdout, stderr = ssh.exec_command(cmd)

print("--- STDOUT ---")
for line in stdout:
    print(line, end="")

print("--- STDERR ---")
for line in stderr:
    print(line, end="")

ssh.close()
