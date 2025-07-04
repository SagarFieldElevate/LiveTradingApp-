import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import strategiesRouter from './routes/strategies';
import monitoringRouter from './routes/monitoring';
import tradingRouter from './routes/trading';
import { pineconeService } from './services/pineconeService';
import { strategyManager } from './services/strategyManager';
import { aiParser } from './services/aiParser';
import { technicalIndicators } from './services/technicalIndicators';
import { marketDataStream } from './services/marketDataStream';
import { conditionMonitor } from './services/conditionMonitor';
import { tradeExecutor } from './services/tradeExecutor';
import { portfolioMonitor } from './services/portfolioMonitor';
import { circuitBreaker } from './services/circuitBreaker';
import { complianceLogger } from './services/complianceLogger';
import { notificationService } from './services/notificationService';
import { polygonService } from './services/polygonService';
import { databaseService } from './config/database';
import { tradeHistoryService } from './services/tradeHistoryService';
import { getMetrics } from './monitoring/metrics';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.end(await getMetrics());
});

// Routes
app.use('/api/strategies', strategiesRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/trading', tradingRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('New WebSocket connection established');
  
  socket.on('subscribe', (data) => {
    logger.info('Client subscribed to updates', data);
    socket.join('trading-updates');
  });
  
  socket.on('disconnect', () => {
    logger.info('WebSocket connection closed');
  });
});

// Global error handlers
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  await complianceLogger.logError(error, { type: 'uncaught_exception' });
  circuitBreaker.recordSystemError(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
  await complianceLogger.logError(new Error(String(reason)), { 
    type: 'unhandled_rejection' 
  });
  circuitBreaker.recordSystemError(new Error(String(reason)));
});

// Initialize services in proper order
async function initializeServices() {
  try {
    // 1. Database first (needed by many other services)
    await databaseService.initialize();
    logger.info('Database service initialized');

    // 2. Pinecone second (needed by other services)
    await pineconeService.initialize();
    logger.info('Pinecone service initialized');

    // 3. AI Parser (needed by strategy manager)
    // No initialization needed
    logger.info('AI Parser ready');

    // 4. Strategy Manager
    await strategyManager.initialize();
    logger.info('Strategy Manager initialized');

    // 5. Market Data Stream
    await marketDataStream.connect();
    logger.info('Market Data Stream connected');

    // 6. Polygon Service (for traditional assets)
    await polygonService.initialize();
    logger.info('Polygon Service initialized');

    // 7. Portfolio Monitor
    await portfolioMonitor.initialize();
    logger.info('Portfolio Monitor initialized');

    // 8. Trade Executor
    // Depends on portfolio monitor being initialized
    logger.info('Trade Executor ready');

    // 9. Condition Monitor
    // Depends on market data stream
    logger.info('Condition Monitor ready');

    // Set up entry signal handler with circuit breaker checks
    conditionMonitor.on('entry_signal', async (signal) => {
      try {
        // Check circuit breaker first
        if (!circuitBreaker.isActive()) {
          logger.warn('Circuit breaker is tripped - skipping trade');
          return;
        }

        // Check daily loss
        if (await circuitBreaker.checkDailyLoss()) {
          return;
        }

        // Log trade decision for compliance
        await complianceLogger.logTradeDecision(
          signal,
          marketDataStream.getCurrentPrices(),
          {
            activeStrategies: strategyManager.getActiveStrategies().length,
            openPositions: portfolioMonitor.getOpenPositions().length,
            dailyPnl: (await portfolioMonitor.getPortfolio()).daily_pnl,
            circuitBreakerStatus: circuitBreaker.isActive()
          }
        );

        // Execute trade
        await tradeExecutor.executeTrade(
          signal.strategy,
          'enter',
          'Entry conditions met'
        );
      } catch (error: any) {
        logger.error('Failed to execute entry trade:', error);
        circuitBreaker.recordFailedTrade(signal.strategy.strategy_id);
      }
    });

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 3000;

// Start server after services are ready
httpServer.listen(PORT, async () => {
  await initializeServices();
  logger.info(`Server running on port ${PORT}`);
});

export { app, io };

// Trading routes
import tradingRoutes from './routes/trading';
app.use('/api/trading', tradingRoutes);

// Circuit breaker API endpoint
app.post('/api/circuit-breaker/reset', async (req, res) => {
  const { auth_code, authority } = req.body;
  
  if (auth_code !== process.env.EMERGENCY_AUTH_CODE) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await circuitBreaker.reset(authority || 'ADMIN');
  res.json({ message: 'Circuit breaker reset' });
});

app.get('/api/circuit-breaker/status', (req, res) => {
  res.json({ 
    active: circuitBreaker.isActive(),
    timestamp: new Date().toISOString()
  });
});

// Daily summary job
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 16 && now.getMinutes() === 0) { // 4 PM
    try {
      const portfolio = await portfolioMonitor.getPortfolio();
      const positions = portfolioMonitor.getOpenPositions();
      const closedToday = positions.filter(p => 
        p.exit_time && new Date(p.exit_time).toDateString() === now.toDateString()
      );
      
      await notificationService.sendDailySummary(portfolio, closedToday);
    } catch (error) {
      logger.error('Failed to send daily summary:', error);
    }
  }
}, 60000); // Check every minute 