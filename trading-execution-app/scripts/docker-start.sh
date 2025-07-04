#!/bin/bash

# Start Docker containers for development
echo "🐳 Starting Trading Execution App..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp backend/env.example .env
    echo "✏️  Please edit .env with your API keys before running again."
    exit 1
fi

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Build containers
echo "📦 Building containers..."
docker-compose build

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo "🏥 Checking service health..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "❌ Backend health check failed"
    docker-compose logs backend
fi

echo ""
echo "🎉 Application is running!"
echo "📍 Frontend: http://localhost:3001"
echo "📍 Backend API: http://localhost:3000"
echo "📍 Health Check: http://localhost:3000/health"
echo ""
echo "📋 View logs: docker-compose logs -f"
echo "🛑 Stop services: docker-compose down" 