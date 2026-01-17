#!/bin/bash
set -e

# ==========================================
# Sekolahku Production Deployment Script
# ==========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Sekolahku Deployment Script${NC}"
echo "=================================="

# Step 1: Detect Host IP
HOST_IP=$(hostname -I | awk '{print $1}')
echo -e "📍 Host IP: ${YELLOW}$HOST_IP${NC}"

# Step 2: Check Docker
echo ""
echo -e "${BLUE}[1/7] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    echo "   Run: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker and Docker Compose found${NC}"

# Step 3: Create necessary directories
echo ""
echo -e "${BLUE}[2/7] Creating directories...${NC}"
mkdir -p pb_data pb_public pb_migrations
echo -e "${GREEN}✅ Directories created${NC}"

# Step 4: Create .env.production if not exists
echo ""
echo -e "${BLUE}[3/7] Checking environment configuration...${NC}"
if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from template..."
    cat > .env.production << EOF
# === PocketBase Configuration ===
NEXT_PUBLIC_POCKETBASE_URL=http://${HOST_IP}:8092
POCKETBASE_URL=http://pocketbase:8080

# === Application Configuration ===
NEXT_PUBLIC_APP_URL=http://${HOST_IP}:3000
NEXT_PUBLIC_APP_NAME="Website Sekolah Terpadu"

# === Default Map Configuration (Indonesia - Jakarta) ===
NEXT_PUBLIC_DEFAULT_LAT=-6.200000
NEXT_PUBLIC_DEFAULT_LNG=106.816666
NEXT_PUBLIC_DEFAULT_ZOOM=13

# === Security (Production) ===
NODE_ENV=production
EOF
    echo -e "${GREEN}✅ .env.production created${NC}"
else
    echo -e "${YELLOW}ℹ️  .env.production already exists, skipping creation${NC}"
fi

# Step 5: Export environment variables for docker-compose
echo ""
echo -e "${BLUE}[4/7] Setting environment variables...${NC}"
export NEXT_PUBLIC_POCKETBASE_URL="http://${HOST_IP}:8092"
export NEXT_PUBLIC_APP_URL="http://${HOST_IP}:3000"
export NEXT_PUBLIC_APP_NAME="Website Sekolah Terpadu"
echo -e "${GREEN}✅ Environment variables set${NC}"

# Step 6: Stop existing containers
echo ""
echo -e "${BLUE}[5/7] Stopping existing containers...${NC}"
docker compose down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}✅ Existing containers stopped${NC}"

# Step 7: Build and start
echo ""
echo -e "${BLUE}[6/7] Building and starting containers...${NC}"
echo "   This may take a few minutes on first run..."
docker compose up -d --build

# Step 8: Wait for services to be healthy
echo ""
echo -e "${BLUE}[7/7] Waiting for services to start...${NC}"
echo "   PocketBase starting..."
sleep 5

# Wait for PocketBase
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s http://localhost:8092/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ PocketBase is ready${NC}"
        break
    fi
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
    echo "   Waiting for PocketBase... ($WAIT_COUNT/$MAX_WAIT sec)"
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}   ⚠️  PocketBase taking longer than expected${NC}"
fi

echo "   Next.js starting (may take up to 40 seconds for first build)..."
sleep 10

# Wait for Next.js
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Next.js is ready${NC}"
        break
    fi
    sleep 5
    WAIT_COUNT=$((WAIT_COUNT + 5))
    echo "   Waiting for Next.js... ($WAIT_COUNT/$MAX_WAIT sec)"
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo -e "${YELLOW}   ⚠️  Next.js taking longer than expected (check logs with: docker compose logs sekolahku)${NC}"
fi

# Final status
echo ""
echo "=================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "=================================="
echo ""
echo -e "📱 ${GREEN}Application:${NC} ${YELLOW}http://${HOST_IP}:3000${NC}"
echo -e "🗄️  ${GREEN}PocketBase:${NC}  ${YELLOW}http://${HOST_IP}:8092/_/${NC}"
echo ""
echo -e "${BLUE}📊 Container Status:${NC}"
docker compose ps
echo ""
echo -e "${BLUE}📋 Useful Commands:${NC}"
echo "   Logs:     docker compose logs -f"
echo "   Restart:  docker compose restart"
echo "   Stop:     docker compose down"
echo "   Update:   git pull && docker compose up -d --build"
echo ""
echo -e "${YELLOW}⚠️  First time setup:${NC}"
echo "   1. Open http://${HOST_IP}:8092/_/ to create PocketBase admin account"
echo "   2. Import collections if needed"
echo ""
