import subprocess
import sys

# First, copy project files to server using tar over SSH
# Then run docker compose

host = "100.97.52.50"
user = "kenanga"
password = "20216609"
remote_dir = "/home/kenanga/sekolahku-deploy"

# We'll use subprocess with stdin for password
# First try to run a simple command to test connection
try:
    # Create a script that pipes password to ssh
    cmd = f'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {user}@{host} "echo connected"'
    proc = subprocess.Popen(
        cmd,
        shell=True,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = proc.communicate(input=password + "\n", timeout=30)
    print("STDOUT:", stdout)
    print("STDERR:", stderr)
    print("RC:", proc.returncode)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)

input("Press Enter to continue...")
