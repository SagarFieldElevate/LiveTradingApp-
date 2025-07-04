// Trading configuration
export const tradingConfig = {
  webhook: {
    url: process.env.WEBHOOK_URL!,
    timeout: 30000, // 30 seconds
    retries: 3,
  },
  positions: {
    defaultSizeUSD: parseInt(process.env.POSITION_SIZE_USD || '100'),
    maxPositions: 10,
    maxPositionSizeUSD: 1000,
  },
  monitoring: {
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || '5000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  },
  circuitBreaker: {
    maxDailyTrades: 50,
    maxDailyLossUSD: 1000,
    maxPositionSizeUSD: 500,
  },
  risk: {
    defaultStopLossPercent: 2,
    defaultTakeProfitPercent: 5,
    maxDrawdownPercent: 10,
  },
}; 