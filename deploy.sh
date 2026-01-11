#!/bin/bash

# Deployment Script for Sekolahku

echo "🚀 Starting Deployment..."

# Get Host IP for PocketBase URL
HOST_IP=$(hostname -I | awk '{print $1}')
echo "📍 Host IP detected: $HOST_IP"

# Create necessary directories for PocketBase
mkdir -p pb_data pb_public

# Export IP for docker-compose
export HOST_IP=$HOST_IP

echo "📦 Building and Starting Containers..."
docker compose up -d --build

echo "✅ Deployment Complete!"
echo "📱 App: http://$HOST_IP:3000"
echo "🗄️ Admin: http://$HOST_IP:8090/_/"
