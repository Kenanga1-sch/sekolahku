# Low-Spec Server Deployment Guide

Panduan deployment untuk server dengan spesifikasi rendah (CPU jadul, 4GB RAM) untuk melayani 200+ pengguna concurrent.

## Spesifikasi Minimum

| Komponen | Minimum                   | Recommended      |
| -------- | ------------------------- | ---------------- |
| CPU      | 2 cores (any)             | 4 cores          |
| RAM      | 4GB                       | 6GB              |
| Storage  | 1TB HDD (Slow Random I/O) | SSD Recommended  |
| OS       | Ubuntu 20.04+             | Ubuntu 22.04 LTS |

> [!WARNING]
> **HDD Performance Warning**: Hard disks have very slow random I/O. Swapping to disk will cause the server to freeze ("thrashing"). You MUST configure `vm.swappiness` properly.

## HDD Storage Optimization (Crucial)

Since you are using an HDD, random read/write operations are expensive. Apply these specific tunings:

### 1. Minimize Swapping (Critical)

Swapping on HDD is 100x slower than SSD. Force the OS to avoid it unless absolutely necessary.

```bash
# Set swappiness to 1 (virtually disable swap unless OOM is imminent)
echo 'vm.swappiness=1' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. Disk I/O Scheduler

Use `bfq` for better responsiveness on mechanical drives.

```bash
# Check current scheduler
cat /sys/block/sda/queue/scheduler

# Enable BFQ (replace sda with your drive identifier)
echo bfq | sudo tee /sys/block/sda/queue/scheduler
```

### 3. File System Mount Options

Disable "access time" updates to reduce unnecessary writes on every file read.

Edit `/etc/fstab` and add `noatime` to your root partition options:

```
UUID=... / ext4 defaults,noatime 0 1
```

### 4. Application Configuration

We have tuned SQLite in `db/index.ts` to use:

- **WAL Mode**: Sequential writes (faster on HDD).
- **Mmap**: Usage of OS file cache.
- **Memory Temp Store**: Avoid creating temp files on disk.
- **Synchronous NORMAL**: Reduce fsync calls.

## Arsitektur Deployment

```
┌─────────────────────────────────────────────────────────┐
│                      NGINX                              │
│  (Reverse Proxy + Caching + Rate Limiting + Gzip)       │
│                    Port 80/443                          │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐      ┌─────────────────────┐
│   Next.js App       │      │   Static Cache      │
│   (Standalone)      │      │   /var/cache/nginx  │
│   Port 3000         │      │   100MB max         │
│   256-384MB RAM     │      └─────────────────────┘
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   SQLite Database   │
│   ./data/sekolahku  │
│   WAL Mode          │
└─────────────────────┘
```

## Resource Allocation

```
┌────────────────────────────────────────────────────────┐
│                    4GB RAM ALLOCATION                   │
├────────────────────────────────────────────────────────┤
│  OS + System Services          │  800MB - 1GB          │
│  NGINX (with cache)            │  50-100MB             │
│  Next.js Application           │  256-384MB            │
│  SQLite (in-process)           │  50-100MB             │
│  Node.js heap overhead         │  ~100MB               │
│  ─────────────────────────────────────────────────     │
│  Buffer / Reserve              │  ~1.5GB               │
└────────────────────────────────────────────────────────┘
```

## Installation Steps

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y nginx curl git

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version  # v20.x
nginx -v        # nginx/1.x
```

### 2. Configure Swap (Important for 4GB RAM)

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Configure swappiness (lower = prefer RAM)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 3. Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/sekolahku
sudo chown $USER:$USER /var/www/sekolahku
cd /var/www/sekolahku

# Clone or copy application files
git clone <your-repo-url> .

# Install dependencies
npm ci --production

# Build application
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# Create data directory
mkdir -p data
```

### 4. Configure Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/sekolahku.service
```

Paste this content:

```ini
[Unit]
Description=Sekolahku Next.js Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/sekolahku
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NODE_OPTIONS=--max-old-space-size=384
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=10

# Resource limits
MemoryMax=512M
MemoryHigh=384M
CPUQuota=150%

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/sekolahku/data
ReadWritePaths=/var/www/sekolahku/public/uploads

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable sekolahku
sudo systemctl start sekolahku

# Check status
sudo systemctl status sekolahku
```

### 5. Configure NGINX

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/sekolahku

# Edit and update domain name
sudo nano /etc/nginx/sites-available/sekolahku

# Enable site
sudo ln -s /etc/nginx/sites-available/sekolahku /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Add rate limiting zones to nginx.conf
sudo nano /etc/nginx/nginx.conf
```

Add inside `http` block:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;
```

```bash
# Create cache directory
sudo mkdir -p /var/cache/nginx/sekolahku
sudo chown www-data:www-data /var/cache/nginx/sekolahku

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d sekolah.example.com

# Auto-renewal is configured automatically
```

## Performance Tuning

### Node.js Memory Settings

```bash
# In systemd service or environment
NODE_OPTIONS=--max-old-space-size=384
```

This limits Node.js heap to 384MB, leaving room for:

- OS buffers
- SQLite
- Connection handling

### NGINX Worker Configuration

Edit `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;  # Usually 2-4 for low-spec
events {
    worker_connections 1024;
    multi_accept on;
    use epoll;
}
```

### SQLite Optimization

Already configured in the app:

- WAL mode enabled
- Busy timeout set
- Connection reuse

## Capacity Planning

### Estimated Concurrent Users

| Configuration         | Concurrent Users |
| --------------------- | ---------------- |
| Basic (256MB heap)    | 100-150          |
| Standard (384MB heap) | 150-200          |
| Maximum (512MB heap)  | 200-300          |

### Response Time Targets

| Endpoint Type | Target | With Cache     |
| ------------- | ------ | -------------- |
| Static files  | <50ms  | <10ms (nginx)  |
| API read      | <200ms | <50ms (cached) |
| API write     | <500ms | -              |
| Page render   | <1s    | <200ms         |

## Monitoring

### Check Application Status

```bash
# Service status
sudo systemctl status sekolahku

# Application logs
sudo journalctl -u sekolahku -f

# Memory usage
free -h

# Check health endpoint
curl http://localhost:3000/api/health | jq
```

### Resource Monitoring

```bash
# Install htop for monitoring
sudo apt install htop

# Monitor in real-time
htop

# Check nginx connections
ss -s
```

## Troubleshooting

### High Memory Usage

```bash
# Check Node.js memory
curl http://localhost:3000/api/health | jq '.checks.memory'

# Restart if needed
sudo systemctl restart sekolahku
```

### Slow Response Times

1. Check nginx cache hit rate:

```bash
grep "X-Cache-Status" /var/log/nginx/access.log | sort | uniq -c
```

2. Check database:

```bash
# SQLite integrity check
sqlite3 /var/www/sekolahku/data/sekolahku.db "PRAGMA integrity_check;"
```

### Connection Refused

```bash
# Check if app is running
sudo systemctl status sekolahku

# Check port availability
sudo ss -tlnp | grep 3000

# Check logs
sudo journalctl -u sekolahku --since "10 minutes ago"
```

## Backup Strategy

```bash
# Create backup script
cat > /var/www/sekolahku/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/sekolahku"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
sqlite3 /var/www/sekolahku/data/sekolahku.db ".backup $BACKUP_DIR/db_$DATE.sqlite"

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/sekolahku/public/uploads

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /var/www/sekolahku/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /var/www/sekolahku/backup.sh" | sudo crontab -
```

## Summary

With this configuration, your 4GB RAM server can handle:

- ✅ **200+ concurrent users**
- ✅ **~1000+ requests/minute**
- ✅ **Aggressive caching** (10ms static file response)
- ✅ **Rate limiting** (prevent DDoS/abuse)
- ✅ **Auto-restart** on failure
- ✅ **Memory protection** (won't crash from OOM)

The key optimizations:

1. NGINX caching for static files and public API
2. Limited Node.js heap (384MB)
3. Swap file as safety net
4. Connection pooling and keepalive
5. Gzip compression
6. Rate limiting
