import { databaseService } from '../config/database';
import { logger } from '../utils/logger';
import { Position } from '../types';

export interface TradeRecord {
  id?: number;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entry_price: number;
  exit_price?: number;
  quantity: number;
  entry_time: Date;
  exit_time?: Date;
  pnl?: number;
  status: 'open' | 'closed' | 'failed';
  order_id?: string;
  fees?: number;
  slippage?: number;
  metadata?: any;
}

export interface TradeFilter {
  strategy_id?: string;
  symbol?: string;
  status?: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
}

export interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: number;
  win_rate: number;
  avg_profit: number;
  avg_loss: number;
  max_profit: number;
  max_loss: number;
  avg_trade_duration: number; // in hours
}

export class TradeHistoryService {
  
  async recordTrade(trade: TradeRecord): Promise<number> {
    try {
      const sql = `
        INSERT INTO trades (
          strategy_id, symbol, side, entry_price, exit_price, quantity,
          entry_time, exit_time, pnl, status, order_id, fees, slippage, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        trade.strategy_id,
        trade.symbol,
        trade.side,
        trade.entry_price,
        trade.exit_price || null,
        trade.quantity,
        trade.entry_time.toISOString(),
        trade.exit_time?.toISOString() || null,
        trade.pnl || null,
        trade.status,
        trade.order_id || null,
        trade.fees || 0,
        trade.slippage || 0,
        trade.metadata ? JSON.stringify(trade.metadata) : null
      ];

      const tradeId = await databaseService.insert(sql, params);
      logger.info(`📊 Trade recorded: ID ${tradeId}, ${trade.symbol} ${trade.side} at ${trade.entry_price}`);
      
      return tradeId;
    } catch (error) {
      logger.error('❌ Failed to record trade:', error);
      throw error;
    }
  }

  async updateTrade(tradeId: number, updates: Partial<TradeRecord>): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];

      // Build dynamic UPDATE query
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'metadata' && value !== null) {
            setClauses.push(`${key} = ?`);
            params.push(JSON.stringify(value));
          } else if (key === 'entry_time' || key === 'exit_time') {
            setClauses.push(`${key} = ?`);
            params.push(value instanceof Date ? value.toISOString() : value);
          } else {
            setClauses.push(`${key} = ?`);
            params.push(value);
          }
        }
      });

      if (setClauses.length === 0) {
        logger.warn('No valid updates provided for trade');
        return;
      }

      setClauses.push('updated_at = CURRENT_TIMESTAMP');
      params.push(tradeId);

      const sql = `UPDATE trades SET ${setClauses.join(', ')} WHERE id = ?`;
      
      await databaseService.run(sql, params);
      logger.info(`📊 Trade updated: ID ${tradeId}`);
    } catch (error) {
      logger.error('❌ Failed to update trade:', error);
      throw error;
    }
  }

  async closeTrade(tradeId: number, exitPrice: number, exitTime: Date, pnl: number): Promise<void> {
    try {
      await this.updateTrade(tradeId, {
        exit_price: exitPrice,
        exit_time: exitTime,
        pnl: pnl,
        status: 'closed'
      });
      
      logger.info(`✅ Trade closed: ID ${tradeId}, P&L: ${pnl}`);
    } catch (error) {
      logger.error('❌ Failed to close trade:', error);
      throw error;
    }
  }

  async getTrades(filter: TradeFilter = {}): Promise<TradeRecord[]> {
    try {
      let sql = 'SELECT * FROM trades WHERE 1=1';
      const params: any[] = [];

      // Apply filters
      if (filter.strategy_id) {
        sql += ' AND strategy_id = ?';
        params.push(filter.strategy_id);
      }

      if (filter.symbol) {
        sql += ' AND symbol = ?';
        params.push(filter.symbol);
      }

      if (filter.status) {
        sql += ' AND status = ?';
        params.push(filter.status);
      }

      if (filter.from_date) {
        sql += ' AND entry_time >= ?';
        params.push(filter.from_date.toISOString());
      }

      if (filter.to_date) {
        sql += ' AND entry_time <= ?';
        params.push(filter.to_date.toISOString());
      }

      sql += ' ORDER BY entry_time DESC';

      if (filter.limit) {
        sql += ' LIMIT ?';
        params.push(filter.limit);
      }

      const rows = await databaseService.all(sql, params);
      
      return rows.map(row => ({
        ...row,
        entry_time: new Date(row.entry_time),
        exit_time: row.exit_time ? new Date(row.exit_time) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      logger.error('❌ Failed to get trades:', error);
      throw error;
    }
  }

  async getTradeById(tradeId: number): Promise<TradeRecord | null> {
    try {
      const row = await databaseService.get('SELECT * FROM trades WHERE id = ?', [tradeId]);
      
      if (!row) return null;
      
      return {
        ...row,
        entry_time: new Date(row.entry_time),
        exit_time: row.exit_time ? new Date(row.exit_time) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    } catch (error) {
      logger.error('❌ Failed to get trade by ID:', error);
      throw error;
    }
  }

  async getOpenTrades(strategyId?: string): Promise<TradeRecord[]> {
    const filter: TradeFilter = { status: 'open' };
    if (strategyId) {
      filter.strategy_id = strategyId;
    }
    
    return this.getTrades(filter);
  }

  async getTradeStats(strategyId?: string, days?: number): Promise<TradeStats> {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
          COALESCE(SUM(pnl), 0) as total_pnl,
          MAX(pnl) as max_profit,
          MIN(pnl) as max_loss,
          AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_profit,
          AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss,
          AVG(
            CASE 
              WHEN exit_time IS NOT NULL 
              THEN (julianday(exit_time) - julianday(entry_time)) * 24 
              ELSE NULL 
            END
          ) as avg_trade_duration
        FROM trades 
        WHERE status = 'closed'
      `;
      
      const params: any[] = [];

      if (strategyId) {
        sql += ' AND strategy_id = ?';
        params.push(strategyId);
      }

      if (days) {
        sql += ' AND entry_time >= datetime("now", "-" || ? || " days")';
        params.push(days);
      }

      const result = await databaseService.get(sql, params);
      
      const winRate = result.total_trades > 0 
        ? (result.winning_trades / result.total_trades) * 100 
        : 0;

      return {
        total_trades: result.total_trades || 0,
        winning_trades: result.winning_trades || 0,
        losing_trades: result.losing_trades || 0,
        total_pnl: result.total_pnl || 0,
        win_rate: winRate,
        avg_profit: result.avg_profit || 0,
        avg_loss: result.avg_loss || 0,
        max_profit: result.max_profit || 0,
        max_loss: result.max_loss || 0,
        avg_trade_duration: result.avg_trade_duration || 0
      };
    } catch (error) {
      logger.error('❌ Failed to get trade stats:', error);
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_pnl: 0,
        win_rate: 0,
        avg_profit: 0,
        avg_loss: 0,
        max_profit: 0,
        max_loss: 0,
        avg_trade_duration: 0
      };
    }
  }

  async recordMarketData(symbol: string, price: number, bid?: number, ask?: number, volume?: number, sequence?: number, source: string = 'coinbase'): Promise<void> {
    try {
      const sql = `
        INSERT INTO market_data (symbol, price, bid, ask, volume, sequence_number, source, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        symbol,
        price,
        bid || null,
        ask || null,
        volume || 0,
        sequence || null,
        source,
        new Date().toISOString()
      ];

      await databaseService.insert(sql, params);
    } catch (error) {
      // Don't log every market data error to avoid spam
      if (Math.random() < 0.01) { // Log 1% of errors
        logger.error('❌ Failed to record market data:', error);
      }
    }
  }

  async getRecentPrices(symbol: string, limit: number = 100): Promise<any[]> {
    try {
      const sql = `
        SELECT price, bid, ask, volume, timestamp, source
        FROM market_data 
        WHERE symbol = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      const rows = await databaseService.all(sql, [symbol, limit]);
      return rows.map(row => ({
        ...row,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      logger.error('❌ Failed to get recent prices:', error);
      return [];
    }
  }

  // Convert Position to TradeRecord
  async recordPositionEntry(position: Position): Promise<number> {
    return this.recordTrade({
      strategy_id: position.strategy_id,
      symbol: position.asset,
      side: position.side,
      entry_price: position.entry_price,
      quantity: position.quantity,
      entry_time: position.entry_time,
      status: 'open',
      order_id: position.coinbase_order_id,
      metadata: {
        trailing_stop_price: position.trailing_stop_price,
        take_profit_price: position.take_profit_price
      }
    });
  }

  async recordPositionExit(position: Position): Promise<void> {
    if (!position.exit_time || !position.exit_price || position.pnl === undefined) {
      throw new Error('Position exit data incomplete');
    }

    // Find the trade record by position ID or order ID
    const trades = await this.getTrades({
      strategy_id: position.strategy_id,
      symbol: position.asset,
      status: 'open'
    });

    const trade = trades.find(t => 
      t.order_id === position.coinbase_order_id ||
      (t.entry_price === position.entry_price && t.quantity === position.quantity)
    );

    if (trade) {
      await this.closeTrade(trade.id!, position.exit_price, position.exit_time, position.pnl);
    } else {
      logger.warn(`Trade record not found for position ${position.id}`);
    }
  }
}

export const tradeHistoryService = new TradeHistoryService(); 