import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { io } from '../index';
import { ParsedStrategy, Position, TradeSignal, OrderRequest, OrderResponse } from '../types';
import { pineconeService } from './pineconeService';
import { notificationService } from './notificationService';
import { technicalIndicators } from './technicalIndicators';
import { portfolioMonitor } from './portfolioMonitor';
import { conditionMonitor } from './conditionMonitor';
import { strategyManager } from './strategyManager';

interface TradeOrder {
  side: 'buy' | 'sell';
  product_id: string;
  type: 'limit' | 'market' | 'stop';
  price?: string;
  size?: string;
  funds?: string;
  stop_price?: string;
  stop_limit_price?: string;
  client_oid?: string;
}

interface TradeResult {
  success: boolean;
  order_id?: string;
  message?: string;
  filled_size?: string;
  filled_price?: string;
}

export class TradeExecutor {
  private webhookUrl: string;
  private activeOrders: Map<string, TradeOrder> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL!;
  }

  async initialize(): Promise<void> {
    logger.info('TradeExecutor service initialized');
    
    // Listen for entry signals from condition monitor
    conditionMonitor.on('entry_signal', async (data) => {
      logger.info('Received entry signal:', data);
      // Process the entry signal
      await this.handleEntrySignal(data);
    });
  }

  private async handleEntrySignal(data: any): Promise<void> {
    const { strategy, timestamp } = data;
    
    try {
      await this.executeTrade(strategy, 'enter', 'Entry conditions met');
    } catch (error) {
      logger.error('Failed to handle entry signal:', error);
    }
  }

  async executeTrade(
    strategy: ParsedStrategy,
    signal: 'enter' | 'exit',
    reason: string
  ): Promise<void> {
    try {
      // Pre-trade validation
      this.validatePreTrade(strategy);

      const asset = strategy.required_assets[0]; // Primary trading asset
      const currentPrice = technicalIndicators.getCurrentPrice(asset);
      
      if (!currentPrice) {
        throw new Error('No current price available');
      }

      // Calculate position details
      const positionSize = strategy.position_size || 100; // $100 default
      const quantity = (positionSize / currentPrice).toFixed(8);

      // Calculate stop loss and take profit prices
      const stopLossPrice = await this.calculateStopLoss(
        currentPrice,
        strategy.exit_conditions.stop_loss,
        'buy',
        asset
      );

      const takeProfitPrice = await this.calculateTakeProfit(
        currentPrice,
        strategy.exit_conditions.take_profit,
        'buy',
        asset
      );

      // Create order
      const order: TradeOrder = {
        side: signal === 'enter' ? 'buy' : 'sell',
        product_id: asset,
        type: 'limit',
        price: currentPrice.toFixed(2),
        size: quantity,
        client_oid: uuidv4()
      };

      // Execute with retries
      const result = await this.executeWithRetries(order);

      if (!result.success) {
        throw new Error(`Trade execution failed: ${result.message}`);
      }

      // Create position record
      if (signal === 'enter') {
        const position: Position = {
          id: uuidv4(),
          strategy_id: strategy.strategy_id,
          asset: asset,
          side: 'buy',
          entry_price: parseFloat(result.filled_price || currentPrice.toString()),
          current_price: currentPrice,
          quantity: parseFloat(result.filled_size || quantity),
          trailing_stop_price: stopLossPrice,
          take_profit_price: takeProfitPrice,
          status: 'open',
          entry_time: new Date(),
          coinbase_order_id: result.order_id
        };

        // Save position
        await pineconeService.savePosition(position);
        await portfolioMonitor.addPosition(position);

        // Send notifications
        await notificationService.sendNotification({
          type: 'trade',
          title: 'Position Opened',
          message: `Opened ${position.asset} position at $${position.entry_price}`,
          metadata: {
            strategy: strategy.strategy_name,
            asset: position.asset,
            side: 'buy',
            price: position.entry_price,
            quantity: position.quantity,
            reason: reason
          },
          timestamp: new Date()
        });

        // Emit to frontend
        io.emit('trade:executed', {
          type: 'entry',
          position,
          strategy: strategy.strategy_name
        });

        logger.info(`Position opened for strategy ${strategy.strategy_id}: ${asset} @ ${position.entry_price}`);
      }

    } catch (error: any) {
      logger.error('Trade execution failed:', error);
      
      // Send critical alert
      await notificationService.sendNotification({
        type: 'error',
        title: 'Trade Execution Failed',
        message: error.message,
        metadata: {
          strategy: strategy.strategy_id,
          signal,
          reason
        },
        timestamp: new Date()
      });

      throw error;
    }
  }

  private validatePreTrade(strategy: ParsedStrategy) {
    // Validate stop loss is set
    if (!strategy.stop_loss_percent || strategy.stop_loss_percent <= 0) {
      throw new Error('CRITICAL: Stop loss not set - trade blocked');
    }

    // Validate market data freshness
    for (const asset of strategy.required_assets) {
      if (!technicalIndicators.isDataFresh(asset, 5)) {
        throw new Error(`Stale market data for ${asset} - trade blocked`);
      }

      // Check spread
      const spread = technicalIndicators.getSpread(asset);
      if (spread && spread > 0.5) { // 0.5% max spread
        throw new Error(`High spread detected for ${asset}: ${spread.toFixed(2)}% - trade blocked`);
      }
    }

    // Validate position limits
    const openPositions = portfolioMonitor.getOpenPositions();
    const strategyPositions = openPositions.filter(p => p.strategy_id === strategy.strategy_id);
    
    if (strategyPositions.length > 0) {
      throw new Error('Position already open for this strategy');
    }

    // Check daily loss limit
    const dailyPnL = portfolioMonitor.getDailyPnL();
    if (dailyPnL < -2000) { // $2000 daily loss limit
      throw new Error('Daily loss limit exceeded - trading halted');
    }
  }

  private async calculateStopLoss(
    entryPrice: number,
    stopLossConfig: any,
    side: 'buy' | 'sell',
    asset: string
  ): Promise<number> {
    let stopPrice: number;

    switch (stopLossConfig.type) {
      case 'percentage':
        const percentage = stopLossConfig.value / 100;
        stopPrice = side === 'buy' 
          ? entryPrice * (1 - percentage)
          : entryPrice * (1 + percentage);
        break;
        
      case 'atr':
        try {
          // Properly await ATR calculation
          const atr = await technicalIndicators.calculateATR(asset, 14);
          const atrMultiplier = stopLossConfig.value || 2.0;
          
          stopPrice = side === 'buy'
            ? entryPrice - (atr * atrMultiplier)
            : entryPrice + (atr * atrMultiplier);
        } catch (error) {
          // Fallback to percentage-based stop
          logger.warn(`ATR calculation failed for ${asset}, using 2% stop loss`);
          stopPrice = side === 'buy'
            ? entryPrice * 0.98
            : entryPrice * 1.02;
        }
        break;
        
      default:
        // Default 2% stop loss
        stopPrice = side === 'buy'
          ? entryPrice * 0.98
          : entryPrice * 1.02;
    }

    return parseFloat(stopPrice.toFixed(2));
  }

  private async calculateTakeProfit(
    entryPrice: number,
    takeProfitConfig: any,
    side: 'buy' | 'sell',
    asset: string
  ): Promise<number> {
    let targetPrice: number;

    switch (takeProfitConfig.type) {
      case 'percentage':
        const percentage = takeProfitConfig.value / 100;
        targetPrice = side === 'buy'
          ? entryPrice * (1 + percentage)
          : entryPrice * (1 - percentage);
        break;
        
      case 'atr':
        try {
          // Properly await ATR calculation
          const atr = await technicalIndicators.calculateATR(asset, 14);
          const atrMultiplier = takeProfitConfig.value || 3.0;
          
          targetPrice = side === 'buy'
            ? entryPrice + (atr * atrMultiplier)
            : entryPrice - (atr * atrMultiplier);
        } catch (error) {
          // Fallback to percentage-based target
          logger.warn(`ATR calculation failed for ${asset}, using 5% take profit`);
          targetPrice = side === 'buy'
            ? entryPrice * 1.05
            : entryPrice * 0.95;
        }
        break;
        
      default:
        // Default 5% take profit
        targetPrice = side === 'buy'
          ? entryPrice * 1.05
          : entryPrice * 0.95;
    }

    return parseFloat(targetPrice.toFixed(2));
  }

  private async executeWithRetries(order: TradeOrder): Promise<TradeResult> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        logger.info(`Executing trade attempt ${attempt}/${this.MAX_RETRIES}`);
        
        const response = await axios.post(this.webhookUrl, order, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': 'trading-execution-app'
          }
        });

        if (response.data.success) {
          return response.data;
        }

        lastError = new Error(response.data.message || 'Trade execution failed');
        
      } catch (error: any) {
        lastError = error;
        logger.error(`Trade attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    throw new Error(`Trade failed after ${this.MAX_RETRIES} attempts: ${lastError.message}`);
  }

  async executeSignal(signal: TradeSignal): Promise<OrderResponse | null> {
    // Legacy method for compatibility
    logger.info(`Executing trade signal for ${signal.asset}`);
    return null;
  }

  private async sendWebhookRequest(orderRequest: OrderRequest): Promise<OrderResponse> {
    // Legacy method kept for compatibility
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL not configured');
    }
    
    return {
      order_id: 'mock-order-id',
      status: 'pending',
      timestamp: new Date()
    };
  }

  async closePosition(position: Position, reason: string): Promise<void> {
    try {
      const currentPrice = technicalIndicators.getCurrentPrice(position.asset);
      if (!currentPrice) {
        throw new Error('No current price for position close');
      }

      const order: TradeOrder = {
        side: 'sell',
        product_id: position.asset,
        type: 'market', // Market order for immediate execution
        size: position.quantity.toString(),
        client_oid: uuidv4()
      };

      const result = await this.executeWithRetries(order);

      if (!result.success) {
        throw new Error(`Position close failed: ${result.message}`);
      }

      // Update position
      position.status = 'closed';
      position.exit_time = new Date();
      position.exit_price = parseFloat(result.filled_price || currentPrice.toString());
      position.pnl = (position.exit_price - position.entry_price) * position.quantity;

      // Save updated position
      await pineconeService.savePosition(position);
      await portfolioMonitor.closePosition(position.id);

      // Send notifications
      await notificationService.sendNotification({
        type: 'trade',
        title: 'Position Closed',
        message: `Closed ${position.asset} position at $${position.exit_price}, PnL: $${position.pnl.toFixed(2)}`,
        metadata: {
          strategy: position.strategy_id,
          asset: position.asset,
          side: 'sell',
          price: position.exit_price,
          quantity: position.quantity,
          pnl: position.pnl,
          reason: reason
        },
        timestamp: new Date()
      });

      // Emit to frontend
      io.emit('trade:executed', {
        type: 'exit',
        position,
        pnl: position.pnl,
        reason
      });

      logger.info(`Position closed: ${position.asset} @ ${position.exit_price}, PnL: $${position.pnl.toFixed(2)}`);

    } catch (error: any) {
      logger.error('Failed to close position:', error);
      
      // CRITICAL: Position close failure
      await notificationService.sendNotification({
        type: 'error',
        title: 'CRITICAL: Failed to Close Position',
        message: `Failed to close ${position.asset} position: ${error.message}`,
        metadata: { position, error: error.message },
        timestamp: new Date()
      });

      // Keep trying every 5 seconds until successful
      setTimeout(() => {
        this.closePosition(position, reason);
      }, 5000);
    }
  }

  async emergencyCloseAll(reason: string): Promise<void> {
    logger.warn('EMERGENCY CLOSE ALL POSITIONS INITIATED');
    
    const openPositions = portfolioMonitor.getOpenPositions();
    logger.info(`Closing ${openPositions.length} positions`);

    // Close all positions in parallel
    const closePromises = openPositions.map(position => 
      this.closePosition(position, `EMERGENCY: ${reason}`)
        .catch(error => {
          logger.error(`Failed to close position ${position.id}:`, error);
          return error;
        })
    );

    const results = await Promise.allSettled(closePromises);
    
    const failures = results.filter(r => r.status === 'rejected').length;
    if (failures > 0) {
      logger.error(`${failures} positions failed to close - manual intervention required`);
    }

    // Send emergency notification
    await notificationService.sendNotification({
      type: 'error',
      title: 'Emergency Close All Executed',
      message: `Emergency close executed: ${reason}`,
      metadata: {
        reason,
        total_positions: openPositions.length,
        failures
      },
      timestamp: new Date()
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const tradeExecutor = new TradeExecutor(); 