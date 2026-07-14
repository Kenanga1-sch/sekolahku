import paramiko
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# Kill any stuck build processes
stdin, stdout, stderr = ssh.exec_command('pkill -f "docker compose build" 2>/dev/null; pkill -f "docker build" 2>/dev/null; echo done')
print("Kill old:", stdout.read().decode())

# Now do a fresh deploy with nohup and log
cmd = 'cd /home/kenanga/sekolahku && nohup bash -c \'echo "20216609" | sudo -S docker compose build --no-cache && echo "20216609" | sudo -S docker compose up -d --force-recreate\' > /home/kenanga/sekolahku/deploy2.log 2>&1 &'
stdin, stdout, stderr = ssh.exec_command(cmd)
print("Deploy started.")

ssh.close()
