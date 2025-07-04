import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';
import { portfolioMonitor } from './portfolioMonitor';
import { tradeExecutor } from './tradeExecutor';
import { conditionMonitor } from './conditionMonitor';
import { strategyManager } from './strategyManager';
import { technicalIndicators } from './technicalIndicators';
// import { complianceLogger } from './complianceLogger';

interface CircuitBreakerConfig {
  maxDailyLoss: number;           // $2000 default
  maxDailyLossPercent: number;    // 2% default
  maxConsecutiveStops: number;    // 5 default
  maxFailedTrades: number;        // 3 in 1 hour
  maxSystemErrors: number;        // 10 in 5 minutes
}

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private failedTrades: Date[] = [];
  private systemErrors: Date[] = [];
  private consecutiveStops: Map<string, number> = new Map();
  private isTripped = false;

  constructor() {
    super();
    this.config = {
      maxDailyLoss: 2000,
      maxDailyLossPercent: 2,
      maxConsecutiveStops: 5,
      maxFailedTrades: 3,
      maxSystemErrors: 10
    };
  }

  async checkDailyLoss(): Promise<boolean> {
    const portfolio = await portfolioMonitor.getPortfolio();
    
    // Check absolute loss
    if (portfolio.daily_pnl < -this.config.maxDailyLoss) {
      await this.trip('Daily loss limit exceeded', {
        daily_pnl: portfolio.daily_pnl,
        limit: -this.config.maxDailyLoss
      });
      return true;
    }

    // Check percentage loss
    const lossPercent = (portfolio.daily_pnl / portfolio.total_value) * 100;
    if (lossPercent < -this.config.maxDailyLossPercent) {
      await this.trip('Daily loss percentage exceeded', {
        loss_percent: lossPercent,
        limit: -this.config.maxDailyLossPercent
      });
      return true;
    }

    return false;
  }

  recordFailedTrade(strategyId: string) {
    this.failedTrades.push(new Date());
    
    // Clean old entries
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.failedTrades = this.failedTrades.filter(d => d > oneHourAgo);
    
    if (this.failedTrades.length >= this.config.maxFailedTrades) {
      this.trip('Too many failed trades', {
        failed_count: this.failedTrades.length,
        time_window: '1 hour'
      });
    }
  }

  recordStopLoss(strategyId: string) {
    const current = this.consecutiveStops.get(strategyId) || 0;
    this.consecutiveStops.set(strategyId, current + 1);
    
    if (current + 1 >= this.config.maxConsecutiveStops) {
      this.trip(`Strategy ${strategyId} hit too many consecutive stops`, {
        strategy_id: strategyId,
        consecutive_stops: current + 1
      });
      
      // Disable the problematic strategy
      strategyManager.pauseStrategy(strategyId);
    }
  }

  recordSystemError(error: Error) {
    this.systemErrors.push(new Date());
    
    // Clean old entries
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    this.systemErrors = this.systemErrors.filter(d => d > fiveMinutesAgo);
    
    if (this.systemErrors.length >= this.config.maxSystemErrors) {
      this.trip('Too many system errors', {
        error_count: this.systemErrors.length,
        time_window: '5 minutes',
        latest_error: error.message
      });
    }
  }

  async checkMarketConditions(): Promise<boolean> {
    // Check for extreme market conditions
    const btcPrice = technicalIndicators.getCurrentPrice('BTC-USD');
    if (!btcPrice) return false;

    const priceChange = await technicalIndicators.getPercentageMove('BTC-USD', '1h');
    
    // Circuit breaker for extreme moves
    if (Math.abs(priceChange) > 10) {
      await this.trip('Extreme market movement detected', {
        asset: 'BTC-USD',
        change_percent: priceChange,
        threshold: 10
      });
      return true;
    }

    return false;
  }

  private async trip(reason: string, details: any) {
    if (this.isTripped) return;
    
    logger.error(`CIRCUIT BREAKER TRIPPED: ${reason}`);
    this.isTripped = true;
    
    // 1. Stop all monitoring
    conditionMonitor.stopMonitoring();
    
    // 2. Pause all strategies
    const strategies = strategyManager.getActiveStrategies();
    for (const strategy of strategies) {
      await strategyManager.pauseStrategy(strategy.strategy_id);
    }
    
    // 3. Cancel any pending orders (if implemented)
    
    // 4. Send critical notifications
    await notificationService.sendCriticalAlert(
      `CIRCUIT BREAKER TRIPPED: ${reason}`,
      details
    );
    
    // 5. Log to compliance
    // await complianceLogger.logCircuitBreaker(reason, details);
    
    // Emit event
    this.emit('tripped', { reason, details });
  }

  async reset(authority: string) {
    if (!this.isTripped) return;
    
    logger.info(`Circuit breaker reset by ${authority}`);
    
    this.isTripped = false;
    this.failedTrades = [];
    this.systemErrors = [];
    this.consecutiveStops.clear();
    
    await notificationService.sendTradeAlert({
      type: 'entry',
      strategy_name: 'SYSTEM',
      asset: 'SYSTEM',
      side: 'buy',
      price: 0,
      quantity: 0,
      reason: `Circuit breaker reset by ${authority}`
    });
    
    // Log reset
    // await complianceLogger.logCircuitBreakerReset(authority);
  }

  isActive(): boolean {
    return !this.isTripped;
  }
}

export const circuitBreaker = new CircuitBreaker(); 