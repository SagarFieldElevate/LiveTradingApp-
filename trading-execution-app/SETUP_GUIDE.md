# 🚀 Trading Execution App Setup Guide

## 📋 Prerequisites

1. **Docker Desktop** installed and running
2. **Node.js** (v18+) and npm
3. API keys from various services (detailed below)

## 🔑 Required API Keys

### 1. **Coinbase Advanced Trade API** (for trading execution)
- Go to https://www.coinbase.com/settings/api
- Create a new API key with permissions:
  - `trade` - Create and view trades
  - `view` - View account information
  - `transfer` - Transfer funds between accounts
- Save your:
  - **API Key** (Access Key)
  - **API Secret** (Signing Key)
  - **Passphrase**
  - **Service Account ID**

### 2. **Polygon.io API** (for real-time market data)
- Sign up at https://polygon.io/
- Get your API key from the dashboard
- Free tier gives 5 API calls/minute (upgrade for production)

### 3. **OpenAI API** (for AI strategy parsing)
- Sign up at https://platform.openai.com/
- Create an API key at https://platform.openai.com/api-keys
- Add billing (GPT-4 usage required)

### 4. **Pinecone API** (for vector database)
- Sign up at https://www.pinecone.io/
- Create a new project
- Get your API key from the console
- Create two indexes:
  ```
  Name: tradingbot-favorites
  Dimensions: 1536
  Metric: cosine
  
  Name: tradingbot-execution
  Dimensions: 1536
  Metric: cosine
  ```

### 5. **Slack Webhooks** (for notifications)
- Go to https://api.slack.com/apps
- Create a new app
- Add "Incoming Webhooks" feature
- Create two webhooks:
  - One for trading notifications (#trading-alerts)
  - One for error notifications (#trading-errors)

## 🛠️ Setup Steps

### Step 1: Clone and Navigate
```bash
cd LiveTradingApp/trading-execution-app
```

### Step 2: Create Environment File
Create a `.env` file in the root directory:

```env
# Coinbase Advanced Trade API Configuration
COINBASE_API_KEY=your_access_key
COINBASE_API_SECRET=your_signing_key
COINBASE_PASSPHRASE=your_passphrase
COINBASE_SERVICE_ACCOUNT_ID=your_service_account_id

# Polygon.io Configuration
POLYGON_API_KEY=your_polygon_api_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_FAVORITES_INDEX=tradingbot-favorites
PINECONE_EXECUTION_INDEX=tradingbot-execution

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ERROR_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/ERROR/URL

# Emergency Configuration (IMPORTANT: Change this!)
EMERGENCY_AUTH_CODE=MYSECUREEMERGENCYCODE123

# Trading Configuration
DAILY_LOSS_LIMIT=2000
MAX_POSITION_SIZE=10000
MAX_POSITIONS=10
```

### Step 3: Install Dependencies
```bash
# Install all dependencies
npm run install:all
```

### Step 4: Start the System

#### Option A: Development Mode (Recommended for first run)
```bash
# Using Docker Compose
docker-compose up

# Or run services individually:
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### Option B: Production Mode
```bash
# Copy .env to .env.production and adjust values
cp .env .env.production

# Run production start script
./scripts/start-production.sh

# Or on Windows:
scripts\start-production.bat
```

## 🎯 Quick Start Commands

```bash
# 1. First time setup
npm run install:all

# 2. Start in development
docker-compose up

# 3. Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
# Monitoring: http://localhost:3002 (production only)
```

## ✅ Verification Steps

1. **Check Backend Health:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check Frontend:**
   - Open http://localhost:3001
   - You should see the trading dashboard

3. **Test Pinecone Connection:**
   - Click "Sync from Pinecone" in the UI
   - Should show connection status

4. **Test Market Data:**
   - Check the Market Status component
   - Should show "Connected" when Polygon.io is working

## 🚨 Important Security Notes

1. **NEVER commit .env files to git**
2. **Change the EMERGENCY_AUTH_CODE immediately**
3. **Use Coinbase Sandbox for testing**
4. **Enable 2FA on all service accounts**
5. **Rotate API keys regularly**

## 🐛 Troubleshooting

### Docker Issues
```bash
# Reset Docker environment
docker-compose down -v
docker system prune -a
docker-compose up --build
```

### Port Conflicts
- Backend runs on port 3000
- Frontend runs on port 3001
- Prometheus runs on port 9090
- Grafana runs on port 3002

### Connection Issues
1. Check all API keys are correctly set
2. Verify Pinecone indexes exist
3. Ensure Docker Desktop is running
4. Check firewall settings

## 📊 Monitoring

Once running in production mode:
- **Grafana Dashboard:** http://localhost:3002 (admin/admin)
- **Prometheus Metrics:** http://localhost:9090
- **Health Check:** http://localhost:3000/health

## 🎉 You're Ready!

Once everything is running:
1. Go to http://localhost:3001
2. Click "Sync from Pinecone" to load strategies
3. Review and approve strategies with stop-loss
4. Monitor positions in real-time
5. Use the Kill Switch for emergencies

Remember to start with paper trading before going live! 