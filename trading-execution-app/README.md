# Trading Execution App

A real-time trading execution application that monitors favorited strategies from Pinecone, evaluates entry/exit conditions, and executes trades automatically.

## Architecture

### Backend (Express + TypeScript)
- **Pinecone Service**: Fetches and manages favorited strategies
- **AI Parser**: Uses OpenAI to parse strategy descriptions into structured conditions
- **Market Data Stream**: Real-time market data via Polygon.io WebSocket
- **Condition Monitor**: Evaluates entry/exit conditions
- **Trade Executor**: Executes trades via webhook
- **Portfolio Monitor**: Tracks open positions
- **Notification Service**: Slack integration for alerts
- **Circuit Breaker**: Safety controls and limits
- **Compliance Logger**: Audit trail for all activities

### Frontend (React + Vite + shadcn/ui)
- Real-time dashboard
- Strategy monitoring
- Position tracking
- Trade history
- Performance metrics

## Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- API Keys: Pinecone, OpenAI, Polygon.io, Slack

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env
```

4. Configure your API keys in `.env`

5. Run development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

### Docker Setup

Run the entire application with Docker Compose:

```bash
docker-compose up -d
```

## Environment Variables

### Required API Keys
- `PINECONE_API_KEY`: Your Pinecone API key
- `OPENAI_API_KEY`: OpenAI API key for strategy parsing
- `POLYGON_API_KEY`: Polygon.io API key for market data
- `SLACK_BOT_TOKEN`: Slack bot token for notifications

### Trading Configuration
- `WEBHOOK_URL`: Endpoint for trade execution
- `POSITION_SIZE_USD`: Default position size in USD
- `CHECK_INTERVAL_MS`: How often to check conditions
- `MAX_RETRIES`: Maximum retry attempts for failed operations

## Safety Features

1. **Circuit Breaker**
   - Daily trade limits
   - Maximum position size
   - Daily loss limits

2. **Compliance Logging**
   - All trades logged to JSONL files
   - Complete audit trail
   - Timestamped entries

3. **Error Handling**
   - Graceful degradation
   - Slack error notifications
   - Automatic reconnection for WebSockets

## API Endpoints

- `GET /health` - Health check with service status
- `GET /api/strategies` - List active strategies
- `GET /api/positions` - Current open positions
- `POST /api/strategies/:id/activate` - Activate a strategy
- `POST /api/strategies/:id/pause` - Pause a strategy

## WebSocket Events

- `trading-update` - Real-time trade updates
- `position-update` - Position changes
- `strategy-update` - Strategy status changes
- `error` - Error notifications

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Monitoring

- Logs are stored in `./logs` directory
- Compliance logs in `./logs/compliance`
- Error logs sent to Slack channel
- Real-time monitoring via WebSocket dashboard

## Security Considerations

1. Never commit `.env` files
2. Use environment variables for all secrets
3. Implement rate limiting on API endpoints
4. Regular security audits of dependencies
5. Monitor for unusual trading patterns

## License

MIT 