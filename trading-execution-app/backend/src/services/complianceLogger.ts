import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { databaseService } from '../config/database';
import { TradeSignal } from '../types';

export interface ComplianceEvent {
  id?: number;
  event_type: string;
  strategy_id?: string;
  symbol?: string;
  action?: string;
  details: any;
  risk_assessment?: any;
  approval_status?: 'pending' | 'approved' | 'rejected';
  timestamp?: Date;
  session_id?: string;
  user_id?: string;
}

export class ComplianceLogger {
  private logDir: string;
  private currentSession: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'compliance');
    this.currentSession = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private async logToFile(event: ComplianceEvent): Promise<void> {
    try {
      const logFile = path.join(this.logDir, `compliance-${new Date().toISOString().slice(0, 10)}.jsonl`);
      const logEntry = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date(),
        session_id: event.session_id || this.currentSession
      }) + '\n';
      
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error('Failed to write compliance log to file:', error);
    }
  }

  private async logToDatabase(event: ComplianceEvent): Promise<number | null> {
    try {
      const sql = `
        INSERT INTO compliance_logs (
          event_type, strategy_id, symbol, action, details, 
          risk_assessment, approval_status, session_id, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        event.event_type,
        event.strategy_id || null,
        event.symbol || null,
        event.action || null,
        JSON.stringify(event.details),
        event.risk_assessment ? JSON.stringify(event.risk_assessment) : null,
        event.approval_status || null,
        event.session_id || this.currentSession,
        event.user_id || 'system'
      ];

      return await databaseService.insert(sql, params);
    } catch (error) {
      console.error('Failed to write compliance log to database:', error);
      return null;
    }
  }

  async logEvent(event: ComplianceEvent): Promise<void> {
    // Log to both file and database for redundancy
    await Promise.allSettled([
      this.logToFile(event),
      this.logToDatabase(event)
    ]);
    
    logger.info(`📋 Compliance event logged: ${event.event_type}`);
  }

  async logTradeDecision(
    signal: TradeSignal,
    marketData: any,
    systemState: any
  ): Promise<void> {
    const riskAssessment = {
      volatility: this.calculateVolatility(marketData),
      liquidity_check: this.checkLiquidity(signal.asset),
      position_sizing: this.validatePositionSize(signal, systemState),
      market_conditions: this.assessMarketConditions(marketData),
      strategy_health: this.checkStrategyHealth(signal.strategy_id, systemState)
    };

    await this.logEvent({
      event_type: 'trade_decision',
      strategy_id: signal.strategy_id,
      symbol: signal.asset,
      action: `${signal.action}_${signal.side}`,
      details: {
        signal: signal,
        market_data: marketData,
        system_state: systemState,
        timestamp: new Date()
      },
      risk_assessment: riskAssessment,
      approval_status: 'approved' // Auto-approved for now
    });
  }

  async logError(error: Error, context: any = {}): Promise<void> {
    await this.logEvent({
      event_type: 'system_error',
      details: {
        error_message: error.message,
        error_stack: error.stack,
        context: context,
        timestamp: new Date()
      }
    });

    // Also log to system events table
    try {
      const sql = `
        INSERT INTO system_events (event_type, severity, message, details, source)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await databaseService.insert(sql, [
        'error',
        'error',
        error.message,
        JSON.stringify({ stack: error.stack, context }),
        'compliance_logger'
      ]);
    } catch (dbError) {
      console.error('Failed to log error to system events:', dbError);
    }
  }

  async logStrategyApproval(strategyId: string, userId: string, approved: boolean, reason?: string): Promise<void> {
    await this.logEvent({
      event_type: 'strategy_approval',
      strategy_id: strategyId,
      action: approved ? 'approve' : 'reject',
      details: {
        approved: approved,
        reason: reason || '',
        timestamp: new Date()
      },
      approval_status: approved ? 'approved' : 'rejected',
      user_id: userId
    });
  }

  async logCircuitBreakerEvent(reason: string, systemState: any): Promise<void> {
    await this.logEvent({
      event_type: 'circuit_breaker_triggered',
      details: {
        reason: reason,
        system_state: systemState,
        timestamp: new Date()
      }
    });

    // Log as critical system event
    try {
      const sql = `
        INSERT INTO system_events (event_type, severity, message, details, source)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await databaseService.insert(sql, [
        'circuit_breaker',
        'critical',
        `Circuit breaker triggered: ${reason}`,
        JSON.stringify(systemState),
        'compliance_logger'
      ]);
    } catch (error) {
      console.error('Failed to log circuit breaker event:', error);
    }
  }

  async getComplianceLogs(filter: {
    event_type?: string;
    strategy_id?: string;
    from_date?: Date;
    to_date?: Date;
    limit?: number;
  } = {}): Promise<ComplianceEvent[]> {
    try {
      let sql = 'SELECT * FROM compliance_logs WHERE 1=1';
      const params: any[] = [];

      if (filter.event_type) {
        sql += ' AND event_type = ?';
        params.push(filter.event_type);
      }

      if (filter.strategy_id) {
        sql += ' AND strategy_id = ?';
        params.push(filter.strategy_id);
      }

      if (filter.from_date) {
        sql += ' AND timestamp >= ?';
        params.push(filter.from_date.toISOString());
      }

      if (filter.to_date) {
        sql += ' AND timestamp <= ?';
        params.push(filter.to_date.toISOString());
      }

      sql += ' ORDER BY timestamp DESC';

      if (filter.limit) {
        sql += ' LIMIT ?';
        params.push(filter.limit);
      }

      const rows = await databaseService.all(sql, params);
      
      return rows.map(row => ({
        ...row,
        details: JSON.parse(row.details),
        risk_assessment: row.risk_assessment ? JSON.parse(row.risk_assessment) : undefined,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      logger.error('❌ Failed to get compliance logs:', error);
      return [];
    }
  }

  async getAuditTrail(strategyId: string): Promise<ComplianceEvent[]> {
    return this.getComplianceLogs({
      strategy_id: strategyId,
      limit: 1000
    });
  }

  private calculateVolatility(marketData: any): number {
    // Simple volatility calculation based on bid-ask spread
    if (!marketData || typeof marketData !== 'object') return 0;
    
    const symbols = Object.keys(marketData);
    let totalVolatility = 0;
    let count = 0;

    for (const symbol of symbols) {
      const data = marketData[symbol];
      if (data && data.bid && data.ask && data.price) {
        const spread = (data.ask - data.bid) / data.price;
        totalVolatility += spread;
        count++;
      }
    }

    return count > 0 ? totalVolatility / count : 0;
  }

  private checkLiquidity(asset: string): boolean {
    // Major crypto assets are considered liquid
    const liquidAssets = ['BTC', 'ETH', 'BTC-USD', 'ETH-USD'];
    return liquidAssets.includes(asset);
  }

  private validatePositionSize(signal: TradeSignal, systemState: any): boolean {
    // Basic position sizing validation
    if (!systemState.activeStrategies) return true;
    
    return systemState.activeStrategies < 10; // Max 10 active strategies
  }

  private assessMarketConditions(marketData: any): string {
    const volatility = this.calculateVolatility(marketData);
    
    if (volatility > 0.05) return 'high_volatility';
    if (volatility > 0.02) return 'moderate_volatility';
    return 'normal';
  }

  private checkStrategyHealth(strategyId: string, systemState: any): boolean {
    // Check if strategy has been performing well
    if (!systemState.dailyPnl) return true;
    
    return systemState.dailyPnl > -1000; // Not losing more than $1000/day
  }
}

export const complianceLogger = new ComplianceLogger(); 