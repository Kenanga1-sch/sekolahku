#!/bin/bash
# ============================================
# Sekolahku Integration Check Script
# Memeriksa status integrasi Next.js + PocketBase
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Sekolahku Integration Check          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# PocketBase port (sesuaikan jika berbeda)
PB_PORT=${PB_PORT:-8092}
PB_HOST=${PB_HOST:-127.0.0.1}

# 1. Check PocketBase Health
echo "1️⃣  PocketBase Health (port $PB_PORT):"
PB_HEALTH=$(curl -s "http://$PB_HOST:$PB_PORT/api/health" 2>/dev/null)
if [ -n "$PB_HEALTH" ] && echo "$PB_HEALTH" | grep -q "healthy"; then
    echo -e "   ${GREEN}✅ API is healthy${NC}"
else
    echo -e "   ${RED}❌ PocketBase tidak bisa diakses${NC}"
    echo "   Hint: Jalankan 'docker-compose up -d' atau './pocketbase serve'"
fi

# 2. Check Docker containers
echo ""
echo "2️⃣  Docker Containers:"
if command -v docker &> /dev/null; then
    CONTAINERS=$(docker ps --format "{{.Names}}: {{.Status}}" 2>/dev/null | grep -E "sekolah" || true)
    if [ -n "$CONTAINERS" ]; then
        echo "$CONTAINERS" | while read line; do
            echo -e "   ${GREEN}✅ $line${NC}"
        done
    else
        echo -e "   ${YELLOW}⚠️  Tidak ada container 'sekolah' yang berjalan${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  Docker tidak terinstall${NC}"
fi

# 3. Check Collections
echo ""
echo "3️⃣  Collections (dari pb_schema.json):"
if [ -f "$PROJECT_ROOT/pb_schema.json" ]; then
    COLLECTIONS=$(python3 -c "import json; data=json.load(open('$PROJECT_ROOT/pb_schema.json')); print(', '.join([c['name'] for c in data]))" 2>/dev/null)
    echo -e "   ${GREEN}✅ $COLLECTIONS${NC}"
else
    echo -e "   ${RED}❌ pb_schema.json tidak ditemukan${NC}"
fi

# 4. Test API Endpoints
echo ""
echo "4️⃣  API Endpoints (Public Access):"

test_collection() {
    local name=$1
    local result=$(curl -s "http://$PB_HOST:$PB_PORT/api/collections/$name/records" 2>/dev/null)
    if echo "$result" | grep -q "items"; then
        local count=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('totalItems', 0))" 2>/dev/null || echo "?")
        echo -e "   ${GREEN}✅ $name: $count records${NC}"
    else
        echo -e "   ${RED}❌ $name: tidak bisa diakses${NC}"
    fi
}

test_collection "spmb_periods"
test_collection "announcements"
test_collection "school_settings"

# 5. Check ENV config
echo ""
echo "5️⃣  ENV Configuration:"
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    PB_URL=$(grep "NEXT_PUBLIC_POCKETBASE_URL" "$PROJECT_ROOT/.env.local" 2>/dev/null | cut -d'=' -f2)
    if [ -n "$PB_URL" ]; then
        echo -e "   ${GREEN}✅ POCKETBASE_URL: $PB_URL${NC}"
    else
        echo -e "   ${YELLOW}⚠️  POCKETBASE_URL tidak dikonfigurasi${NC}"
    fi
else
    echo -e "   ${RED}❌ .env.local tidak ditemukan${NC}"
    echo "   Hint: cp .env.example .env.local"
fi

# 6. Check if Next.js app is running
echo ""
echo "6️⃣  Next.js App:"
APP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null || echo "000")
if [ "$APP_HEALTH" = "200" ]; then
    echo -e "   ${GREEN}✅ App berjalan di port 3000${NC}"
elif [ "$APP_HEALTH" = "000" ]; then
    echo -e "   ${RED}❌ App tidak bisa diakses di port 3000${NC}"
else
    echo -e "   ${YELLOW}⚠️  App merespon dengan status $APP_HEALTH${NC}"
fi

echo ""
echo "════════════════════════════════════════"
echo "Selesai! $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
