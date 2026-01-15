#!/bin/bash
# ==========================================
# Sekolahku Production Startup Script
# Optimized for 4GB RAM Server
# ==========================================

set -e

echo "🚀 Starting Sekolahku in production mode..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if standalone build exists
if [ ! -f ".next/standalone/server.js" ]; then
    echo -e "${YELLOW}⚠️  Standalone build not found. Building...${NC}"
    NODE_OPTIONS="--max-old-space-size=1024" npm run build
fi

# Copy static files if needed
if [ ! -d ".next/standalone/.next/static" ]; then
    echo "📁 Copying static files..."
    cp -r .next/static .next/standalone/.next/
fi

# Copy public files if needed
if [ ! -d ".next/standalone/public" ]; then
    echo "📁 Copying public files..."
    cp -r public .next/standalone/
fi

# Start the server with memory limit
echo -e "${GREEN}✅ Starting server with 512MB memory limit...${NC}"
echo ""
echo "🌐 Application: http://localhost:3000"
echo "📊 PocketBase:  http://localhost:8092/_/"
echo ""

cd .next/standalone
NODE_OPTIONS="--max-old-space-size=512" node server.js
