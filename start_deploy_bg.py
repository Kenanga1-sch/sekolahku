import paramiko
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

# Create a deployment script on the server
script_content = """#!/bin/bash
cd /home/kenanga/sekolahku
git pull
echo "20216609" | sudo -S docker compose build --no-cache
echo "20216609" | sudo -S docker compose up -d --force-recreate
"""

# Write it to the server
sftp = ssh.open_sftp()
with sftp.file('/home/kenanga/sekolahku/run_deploy.sh', 'w') as f:
    f.write(script_content)
sftp.close()

# Make it executable and run it in the background
stdin, stdout, stderr = ssh.exec_command('chmod +x /home/kenanga/sekolahku/run_deploy.sh && nohup /home/kenanga/sekolahku/run_deploy.sh > /home/kenanga/sekolahku/deploy.log 2>&1 &')

print("Deploy started in the background on the server.")
ssh.close()
