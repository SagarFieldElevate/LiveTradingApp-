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
  private triggerDelayTracking: Map<string, Date> = new Map(); // Track when triggers were first met

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
        
      case 'single_correlation':
        return await this.checkSingleCorrelation(condition);
        
      case 'multi_asset_correlation':
        return await this.checkMultiAssetCorrelation(condition);
        
      case 'technical_indicator':
        return await this.checkTechnicalIndicator(condition);
        
      default:
        logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private async checkPercentageMove(condition: EntryCondition): Promise<boolean> {
    if (!condition.primary_asset || condition.threshold === undefined) {
      logger.error('Invalid percentage move condition - missing primary_asset or threshold');
      return false;
    }

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
        default:
          conditionMet = Math.abs(percentMove) > condition.threshold;
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
    if (!condition.secondary_asset || !condition.additional_params?.correlation_threshold || condition.threshold === undefined) {
      logger.error('Invalid correlation condition - missing required fields');
      return false;
    }

    try {
      // First check correlation threshold
      const primaryAsset = condition.primary_asset || 'BTC';
      const correlation = await technicalIndicators.calculateCorrelation(
        primaryAsset,
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

  private async checkSingleCorrelation(condition: EntryCondition): Promise<boolean> {
    if (!condition.secondary_asset || !condition.threshold) {
      logger.error('Invalid single correlation condition - missing secondary_asset or threshold');
      return false;
    }

    try {
      // Check correlation threshold if specified
      if (condition.additional_params?.correlation_threshold) {
        const correlation = await technicalIndicators.calculateCorrelation(
          condition.primary_asset || condition.target_asset || 'BTC',
          condition.secondary_asset,
          20 // 20 period correlation
        );

        if (Math.abs(correlation) < condition.additional_params.correlation_threshold) {
          return false; // Correlation not strong enough
        }
      }

      // Check for the percentage move
      const percentMove = await technicalIndicators.getPercentageMove(
        condition.secondary_asset,
        condition.timeframe || '1h'
      );

      const moveConditionMet = Math.abs(percentMove) > condition.threshold;

      if (moveConditionMet) {
        logger.info(`Single correlation condition met: ${condition.secondary_asset} moved ${percentMove.toFixed(2)}%`);
      }

      return moveConditionMet;
    } catch (error) {
      logger.error('Error checking single correlation:', error);
      return false;
    }
  }

  private async checkMultiAssetCorrelation(condition: EntryCondition): Promise<boolean> {
    if (!condition.triggers || !Array.isArray(condition.triggers) || condition.triggers.length === 0) {
      logger.error('Invalid multi asset correlation condition - missing triggers');
      return false;
    }

    try {
      // Check all triggers first
      const triggerResults = await Promise.all(
        condition.triggers.map(async (trigger) => {
          if (!trigger.asset) {
            logger.warn('Trigger missing asset name');
            return false;
          }

          // Use async price fetching for traditional assets
          let percentMove: number;
          if (['WTI_CRUDE_OIL', 'GOLD', 'SPY', 'QQQ'].includes(trigger.asset)) {
            const currentPrice = await technicalIndicators.getCurrentPriceAsync(trigger.asset);
            if (!currentPrice) {
              logger.warn(`No price data available for ${trigger.asset}`);
              return false;
            }
            // Calculate simple percentage move (would need historical data for proper calculation)
            percentMove = 0; // Placeholder - needs proper historical price comparison
          } else {
            percentMove = await technicalIndicators.getPercentageMove(
              trigger.asset,
              condition.timeframe || '1h'
            );
          }

          const threshold = trigger.threshold_percent || 2.0; // Default 2% threshold
          
          let conditionMet = false;
          switch (trigger.direction) {
            case 'up':
              conditionMet = percentMove > threshold;
              break;
            case 'down':
              conditionMet = percentMove < -threshold;
              break;
            default:
              conditionMet = Math.abs(percentMove) > threshold;
          }

          if (conditionMet) {
            logger.info(`Multi-asset trigger met: ${trigger.asset} moved ${percentMove.toFixed(2)}% ${trigger.direction}`);
          }

          return conditionMet;
        })
      );

      // All triggers must be met for multi-asset condition
      const allTriggersActive = triggerResults.every(result => result === true);
      
      if (!allTriggersActive) {
        return false;
      }

      // Handle delay_days if specified
      if (condition.delay_days && condition.delay_days > 0) {
        const delayKey = `${condition.target_asset}_${condition.triggers.map(t => t.asset).join('_')}`;
        const now = new Date();
        
        // Check if triggers were already activated
        if (this.triggerDelayTracking.has(delayKey)) {
          const triggerTime = this.triggerDelayTracking.get(delayKey)!;
          const daysSinceTriggered = (now.getTime() - triggerTime.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceTriggered >= condition.delay_days) {
            logger.info(`Delay period of ${condition.delay_days} days has passed for ${condition.target_asset}`);
            // Remove from tracking since condition is now met
            this.triggerDelayTracking.delete(delayKey);
            return true;
          } else {
            logger.info(`Waiting for delay: ${daysSinceTriggered.toFixed(1)}/${condition.delay_days} days for ${condition.target_asset}`);
            return false;
          }
        } else {
          // First time triggers are met, start delay tracking
          this.triggerDelayTracking.set(delayKey, now);
          logger.info(`Multi-asset triggers met for ${condition.target_asset}, starting ${condition.delay_days} day delay`);
          return false;
        }
      }

      // No delay specified, execute immediately
      if (allTriggersActive) {
        logger.info(`All multi-asset triggers met for target: ${condition.target_asset}`);
      }

      return allTriggersActive;
    } catch (error) {
      logger.error('Error checking multi asset correlation:', error);
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