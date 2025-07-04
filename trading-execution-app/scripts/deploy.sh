#!/bin/bash

# Production deployment script
set -e

echo "🚀 Starting deployment..."

# Check environment
if [ "$1" != "production" ] && [ "$1" != "staging" ]; then
    echo "Usage: ./deploy.sh [production|staging]"
    exit 1
fi

ENV=$1
echo "Deploying to: $ENV"

# Load environment variables
if [ -f ".env.$ENV" ]; then
    export $(cat .env.$ENV | xargs)
else
    echo "Error: .env.$ENV file not found"
    exit 1
fi

# Build and test
echo "📦 Building application..."
docker-compose build

echo "🧪 Running tests..."
docker-compose run --rm backend npm test
docker-compose run --rm frontend npm test

# Deploy
echo "🚀 Starting services..."
docker-compose up -d

# Health check
echo "🏥 Checking health..."
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment complete!"

# Show status
docker-compose ps 