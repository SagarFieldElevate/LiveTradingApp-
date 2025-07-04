import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { strategyManager } from './strategyManager';
import { marketDataStream } from './marketDataStream';
import { technicalIndicators } from './technicalIndicators';
import { ParsedStrategy, EntryCondition } from '../types';
import { io } from '../index';

export class ConditionMonitor extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private conditionCheckCount = 0;
  private lastCheckTime = Date.now();

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Condition monitoring already active');
      return;
    }

    logger.info('Starting condition monitoring');
    this.isMonitoring = true;

    // Check conditions every 5 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkAllConditions();
    }, 5000);

    // Listen for market data disconnection
    marketDataStream.on('disconnected', () => {
      this.handleMarketDisconnection();
    });

    marketDataStream.on('connected', () => {
      this.handleMarketReconnection();
    });
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      this.emit('monitoring:stopped');
      logger.info('Condition monitoring stopped');
    }
  }

  private async checkAllConditions() {
    // Safety check - ensure market data is connected
    if (!marketDataStream.getConnectionStatus()) {
      logger.warn('Skipping condition check - market data disconnected');
      return;
    }

    const startTime = Date.now();
    this.conditionCheckCount++;

    try {
      const activeStrategies = strategyManager.getActiveStrategies();
      
      for (const strategy of activeStrategies) {
        try {
          await this.checkStrategyConditions(strategy);
        } catch (error) {
          logger.error(`Error checking conditions for strategy ${strategy.strategy_id}:`, error);
        }
      }

      const checkTime = Date.now() - startTime;
      
      // Alert if checks are taking too long
      if (checkTime > 1000) {
        logger.warn(`Condition check took ${checkTime}ms - performance issue`);
      }

      // Emit monitoring stats
      io.emit('monitor:stats', {
        checkCount: this.conditionCheckCount,
        lastCheckTime: checkTime,
        activeStrategies: activeStrategies.length
      });

    } catch (error) {
      logger.error('Critical error in condition monitoring:', error);
      this.emit('critical_error', error);
    }
  }

  private async checkStrategyConditions(strategy: ParsedStrategy) {
    // Verify all required data is fresh
    for (const asset of strategy.required_assets) {
      if (!technicalIndicators.isDataFresh(asset, 10)) {
        logger.warn(`Stale data for ${asset} - skipping strategy ${strategy.strategy_id}`);
        return;
      }
    }

    // Check entry conditions
    const shouldEnter = await this.evaluateEntryConditions(strategy);
    
    if (shouldEnter) {
      logger.info(`Entry conditions met for strategy ${strategy.strategy_id}`);
      
      this.emit('entry_signal', {
        strategy,
        timestamp: new Date(),
        conditions_met: true
      });
    }
  }

  private async evaluateEntryConditions(strategy: ParsedStrategy): Promise<boolean> {
    const condition = strategy.entry_conditions;
    
    switch (condition.type) {
      case 'percentage_move':
        return await this.checkPercentageMove(condition);
        
      case 'correlation':
        return await this.checkCorrelation(condition);
        
      case 'technical_indicator':
        return await this.checkTechnicalIndicator(condition);
        
      default:
        logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private async checkPercentageMove(condition: EntryCondition): Promise<boolean> {
    try {
      const percentMove = await technicalIndicators.getPercentageMove(
        condition.primary_asset,
        condition.timeframe || '1h'
      );

      let conditionMet = false;
      
      switch (condition.direction) {
        case 'up':
          conditionMet = percentMove > condition.threshold;
          break;
        case 'down':
          conditionMet = percentMove < -condition.threshold;
          break;
        case 'any':
          conditionMet = Math.abs(percentMove) > condition.threshold;
          break;
      }

      if (conditionMet) {
        logger.info(`Percentage move condition met: ${condition.primary_asset} moved ${percentMove.toFixed(2)}%`);
      }

      return conditionMet;
    } catch (error) {
      logger.error('Error checking percentage move:', error);
      return false;
    }
  }

  private async checkCorrelation(condition: EntryCondition): Promise<boolean> {
    if (!condition.secondary_asset || !condition.additional_params?.correlation_threshold) {
      logger.error('Invalid correlation condition');
      return false;
    }

    try {
      // First check correlation threshold
      const correlation = await technicalIndicators.calculateCorrelation(
        condition.primary_asset,
        condition.secondary_asset,
        20 // 20 period correlation
      );

      if (Math.abs(correlation) < condition.additional_params.correlation_threshold) {
        return false; // Correlation not strong enough
      }

      // Then check for the percentage move
      const percentMove = await technicalIndicators.getPercentageMove(
        condition.secondary_asset,
        condition.timeframe || '1h'
      );

      const moveConditionMet = Math.abs(percentMove) > condition.threshold;

      if (moveConditionMet) {
        logger.info(`Correlation condition met: ${condition.secondary_asset} moved ${percentMove.toFixed(2)}% with correlation ${correlation.toFixed(3)}`);
      }

      return moveConditionMet;
    } catch (error) {
      logger.error('Error checking correlation:', error);
      return false;
    }
  }

  private async checkTechnicalIndicator(condition: EntryCondition): Promise<boolean> {
    // Implement specific technical indicators as needed
    logger.warn('Technical indicator conditions not yet implemented');
    return false;
  }

  private handleMarketDisconnection() {
    logger.error('CRITICAL: Market data disconnected - halting all condition monitoring');
    
    // Stop monitoring immediately
    this.stopMonitoring();
    
    // Notify all systems
    this.emit('monitoring_halted', 'Market data disconnection');
    io.emit('monitor:halted', {
      reason: 'Market data disconnection',
      timestamp: new Date()
    });
  }

  private handleMarketReconnection() {
    logger.info('Market data reconnected - waiting for data stabilization');
    
    // Wait 10 seconds for data to stabilize before resuming
    setTimeout(() => {
      if (marketDataStream.getConnectionStatus()) {
        logger.info('Resuming condition monitoring');
        this.startMonitoring();
      }
    }, 10000);
  }

  getMonitoringStatus(): boolean {
    return this.isMonitoring;
  }

  async initialize() {
    logger.info('ConditionMonitor service initialized');
  }
}

export const conditionMonitor = new ConditionMonitor(); 