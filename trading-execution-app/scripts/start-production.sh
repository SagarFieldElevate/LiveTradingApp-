#!/bin/bash

echo "🚀 Starting Trading Execution System in Production Mode"

# Verify environment
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production not found"
    exit 1
fi

# Load environment
export $(cat .env.production | xargs)

# Pre-flight checks
echo "✅ Running pre-flight checks..."
./scripts/preflight-check.sh || exit 1

# Start services
echo "🚀 Starting services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 30

# Health checks
echo "🏥 Running health checks..."
curl -f http://localhost:3000/health || exit 1
curl -f http://localhost:3001 || exit 1

# Run smoke tests
echo "🧪 Running smoke tests..."
npm run test:smoke

# Enable monitoring
echo "📊 Enabling monitoring..."
./scripts/enable-monitoring.sh

echo "✅ System started successfully!"
echo "📊 Dashboard: http://localhost:3001"
echo "📈 Monitoring: http://localhost:3002"
echo "🔍 Logs: docker-compose logs -f" 