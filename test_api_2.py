import paramiko
import sys
import codecs
import json

sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('100.97.52.50', username='kenanga', password='20216609')

cmd = 'curl -s http://localhost:3000/api/master/employees'
stdin, stdout, stderr = ssh.exec_command(cmd)

resp = stdout.read().decode()
try:
    data = json.loads(resp)
    print("KEYS:", data.keys())
    if 'data' in data and len(data['data']) > 0:
        first_emp = data['data'][0]
        print("FIRST EMP KEYS:", first_emp.keys())
        print("NAME:", first_emp.get('name'))
        print("FULLNAME:", first_emp.get('fullName'))
        print("PHONE:", first_emp.get('phone'))
except Exception as e:
    print("RAW:", resp)
    print("ERR:", e)

ssh.close()
