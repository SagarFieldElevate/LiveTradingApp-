#!/bin/bash

echo "🔍 Running pre-flight checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check environment variables
REQUIRED_VARS=(
    "COINBASE_API_KEY"
    "COINBASE_API_SECRET"
    "POLYGON_API_KEY"
    "OPENAI_API_KEY"
    "PINECONE_API_KEY"
    "PINECONE_FAVORITES_INDEX"
    "PINECONE_EXECUTION_INDEX"
    "SLACK_WEBHOOK_URL"
    "SLACK_ERROR_WEBHOOK_URL"
    "EMERGENCY_AUTH_CODE"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done

# Check ports
PORTS=(3000 3001 9090 3002)
for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $port is already in use"
    fi
done

# Check disk space (require at least 10GB)
AVAILABLE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE" -lt 10 ]; then
    echo "❌ Insufficient disk space. Available: ${AVAILABLE}GB, Required: 10GB"
    exit 1
fi

echo "✅ All pre-flight checks passed!" 