import { register, Counter, Histogram, Gauge } from 'prom-client';

// Metrics
export const tradingMetrics = {
  // Counters
  tradesExecuted: new Counter({
    name: 'trades_executed_total',
    help: 'Total number of trades executed',
    labelNames: ['strategy', 'side', 'status']
  }),

  // Histograms
  tradeLatency: new Histogram({
    name: 'trade_execution_duration_seconds',
    help: 'Trade execution latency',
    buckets: [0.1, 0.5, 1, 2, 5]
  }),

  conditionCheckDuration: new Histogram({
    name: 'condition_check_duration_seconds',
    help: 'Time to check all strategy conditions',
    buckets: [0.01, 0.05, 0.1, 0.5, 1]
  }),

  // Gauges
  openPositions: new Gauge({
    name: 'open_positions_total',
    help: 'Number of open positions'
  }),

  portfolioValue: new Gauge({
    name: 'portfolio_value_usd',
    help: 'Total portfolio value in USD'
  }),

  activeStrategies: new Gauge({
    name: 'active_strategies_total',
    help: 'Number of active strategies'
  }),

  marketDataLag: new Gauge({
    name: 'market_data_lag_seconds',
    help: 'Market data latency',
    labelNames: ['symbol']
  })
};

// Metrics endpoint
export function getMetrics() {
  return register.metrics();
} 