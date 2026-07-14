import paramiko
import sys
import codecs

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

stdin, stdout, stderr = ssh.exec_command('tail -n 15 /home/kenanga/sekolahku/deploy2.log')
print(stdout.read().decode())

ssh.close()
