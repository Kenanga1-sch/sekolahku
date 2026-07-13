import paramiko
import os
import sys

def main():
    host = '100.97.52.50'
    username = 'kenanga'
    password = '20216609'
    remote_dir = '/home/kenanga/sekolahku' # Actually let's assume the repo is just cloned there. Wait, earlier script used `/home/kenanga/sekolahku-deploy` but that was for manual deployment. Since it's github, maybe it's `/home/kenanga/sekolahku` or the user has a specific dir. Let's find out by running ls first, or just assume it's `sekolahku`. Let's assume `sekolahku`.

    print("Connecting via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password)
    print("Connected.")

    # 1. Pull from github
    print("Running git pull...")
    cmd = f'cd /home/kenanga/sekolahku && git pull origin main'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    print("=== GIT PULL ===")
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    # 2. Rebuild Docker containers
    print("Rebuilding Docker containers...")
    cmd = f'cd /home/kenanga/sekolahku && sudo -S sh -c "docker compose down && docker compose up -d --build"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdin.write(f"{password}\\n")
    stdin.flush()

    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("=== DOCKER COMPOSE ===")
    print(out)
    print(err)

    ssh.close()
    print("Done!")

if __name__ == "__main__":
    main()
