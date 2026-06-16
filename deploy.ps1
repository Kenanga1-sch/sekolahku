$hostname = "100.97.52.50"
$username = "kenanga"
$password = "20216609"
$remoteDir = "/home/kenanga/sekolahku-deploy"
$localDir = "D:\antigravity\sekolahku"

Write-Host "=== 1. Creating archive (excluding heavy dirs) ==="
$tempTar = "$env:TEMP\sekolahku-deploy.tar.gz"

# Build exclusion list
$excludes = @(
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=out",
    "--exclude=.git",
    "--exclude=.claude",
    "--exclude=.husky",
    "--exclude=.vscode",
    "--exclude=data",
    "--exclude=uploads",
    "--exclude=public/uploads",
    "--exclude=public\uploads",
    "--exclude=playwright-report",
    "--exclude=test-results",
    "--exclude=dist",
    "--exclude=scratch",
    "--exclude=backups",
    "--exclude=go-backend/bin",
    "--exclude=go-backend/.gocache",
    "--exclude=.gocache*",
    "--exclude=*.exe",
    "--exclude=*.zip",
    "--exclude=*.tgz",
    "--exclude=*.tar.gz",
    "--exclude=*.log",
    "--exclude=eslint-report.json",
    "--exclude=deploy*",
    "--exclude=.env*"
)

# Remove old archive
Remove-Item $tempTar -ErrorAction SilentlyContinue

# Create tar archive
& tar -czf $tempTar -C $localDir $excludes .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create archive"
    exit 1
}

$size = (Get-Item $tempTar).Length / 1MB
Write-Host "Archive created: $([math]::Round($size, 1)) MB"

Write-Host "=== 2. Copying archive to server ==="
& sshpass -p $password ssh -o StrictHostKeyChecking=no $username@$hostname "mkdir -p $remoteDir"
& sshpass -p $password scp -o StrictHostKeyChecking=no $tempTar "$username@$hostname`:$remoteDir/archive.tar.gz"

Write-Host "=== 3. Extracting on server ==="
& sshpass -p $password ssh -o StrictHostKeyChecking=no $username@$hostname @"
    cd $remoteDir
    tar -xzf archive.tar.gz
    rm archive.tar.gz
"@

Write-Host "=== 4. Rebuilding Docker containers ==="
& sshpass -p $password ssh -o StrictHostKeyChecking=no $username@$hostname @"
    echo '$password' | sudo -S docker compose -f $remoteDir/docker-compose.yml down 2>/dev/null
    echo '$password' | sudo -S docker compose -f $remoteDir/docker-compose.yml up -d --build
"@

Write-Host "=== Deployment complete! ==="
Write-Host "Check http://100.97.52.50:3000"
