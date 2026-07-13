import paramiko
import os
import sys

def progress_callback(transferred, total):
    percent = (transferred / total) * 100
    sys.stdout.write(f"\rUploading: {percent:.2f}% ({transferred}/{total} bytes)")
    sys.stdout.flush()

def main():
    host = '100.97.52.50'
    username = 'kenanga'
    password = '20216609'
    local_tar = 'sekolahku-deploy.tar.gz'
    remote_dir = '/home/kenanga/sekolahku-deploy'
    remote_tar = f"{remote_dir}/archive.tar.gz"

    if not os.path.exists(local_tar):
        print(f"Error: {local_tar} not found!")
        return

    print("Connecting via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=username, password=password)
    print("Connected.")
    
    # Ensure remote directory exists
    ssh.exec_command(f"mkdir -p {remote_dir}")

    print("Starting SFTP upload...")
    sftp = ssh.open_sftp()
    sftp.put(local_tar, remote_tar, callback=progress_callback)
    sftp.close()
    print("\nUpload completed successfully!")

    print("Extracting on server...")
    stdin, stdout, stderr = ssh.exec_command(f"cd {remote_dir} && tar -xzf archive.tar.gz && rm archive.tar.gz")
    err = stderr.read().decode('utf-8')
    if err:
        print("Extraction error/output:")
        print(err)

    print("Rebuilding Docker containers...")
    cmd = f'cd {remote_dir} && sudo -S sh -c "docker compose down && docker compose up -d --build"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdin.write(f"{password}\n")
    stdin.flush()

    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("=== STDOUT ===")
    print(out)
    print("=== STDERR ===")
    print(err)

    ssh.close()
    print("Done!")

if __name__ == "__main__":
    main()
