#!/bin/bash

echo "===================================="
echo "Trading Execution App Quick Start"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found!"
    echo ""
    echo "Please create a .env file with your API keys."
    echo "You can copy env.example to .env and fill in your values."
    echo ""
    echo "Example:"
    echo "  cp env.example .env"
    echo "  nano .env"
    echo ""
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not running!"
    echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo ""
echo "Starting Trading Execution System..."
echo ""
echo "This will:"
echo "1. Start the backend API on http://localhost:3000"
echo "2. Start the frontend UI on http://localhost:3001"
echo "3. Connect to market data streams"
echo "4. Initialize monitoring systems"
echo ""
echo "Press Ctrl+C to stop the system at any time."
echo ""
read -p "Press Enter to continue..."

echo ""
echo "Starting services with Docker Compose..."
docker-compose up 