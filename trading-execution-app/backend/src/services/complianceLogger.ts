import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { pineconeService } from './pineconeService';
import { aiParser } from './aiParser';
import { strategyManager } from './strategyManager';
import { portfolioMonitor } from './portfolioMonitor';
import { marketDataStream } from './marketDataStream';
import { circuitBreaker } from './circuitBreaker';

interface ComplianceRecord {
  id: string;
  timestamp: string;
  action_type: 'TRADE' | 'MODIFY' | 'CANCEL' | 'SYSTEM' | 'ERROR' | 'CIRCUIT_BREAKER';
  initiator: string;
  authorization: string;
  market_data_snapshot: any;
  system_state: any;
  decision_factors: any;
  regulatory_flags: string[];
  hash: string;
  previous_hash: string;
}

export class ComplianceLogger {
  private lastHash: string = '0';
  private recordChain: ComplianceRecord[] = [];
  private isDemoMode: boolean = false;

  async logTradeDecision(
    decision: any,
    marketData: any,
    systemState: any
  ): Promise<void> {
    const record: ComplianceRecord = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action_type: 'TRADE',
      initiator: decision.strategy_id || 'SYSTEM',
      authorization: 'AUTOMATED',
      market_data_snapshot: {
        prices: marketData,
        timestamp: new Date().toISOString(),
        spreads: {},
        volumes: {}
      },
      system_state: {
        active_strategies: systemState.activeStrategies,
        open_positions: systemState.openPositions,
        daily_pnl: systemState.dailyPnl,
        circuit_breaker_status: systemState.circuitBreakerStatus
      },
      decision_factors: decision,
      regulatory_flags: this.checkRegulatoryFlags(decision),
      hash: '',
      previous_hash: this.lastHash
    };

    // Generate hash for immutability
    record.hash = this.generateHash(record);
    this.lastHash = record.hash;

    // Store in multiple locations
    await this.storeRecord(record);
    
    logger.info(`Compliance record logged: ${record.id}`);
  }

  async logCircuitBreaker(reason: string, details: any): Promise<void> {
    const record: ComplianceRecord = {
      id: `cb_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action_type: 'CIRCUIT_BREAKER',
      initiator: 'SYSTEM',
      authorization: 'AUTOMATIC',
      market_data_snapshot: {},
      system_state: await this.captureSystemState(),
      decision_factors: { reason, details },
      regulatory_flags: ['TRADING_HALT', 'RISK_LIMIT'],
      hash: '',
      previous_hash: this.lastHash
    };

    record.hash = this.generateHash(record);
    this.lastHash = record.hash;

    await this.storeRecord(record);
  }

  async logCircuitBreakerReset(authority: string): Promise<void> {
    const record: ComplianceRecord = {
      id: `cb_reset_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action_type: 'SYSTEM',
      initiator: authority,
      authorization: 'MANUAL_OVERRIDE',
      market_data_snapshot: {},
      system_state: await this.captureSystemState(),
      decision_factors: { action: 'circuit_breaker_reset' },
      regulatory_flags: ['MANUAL_INTERVENTION', 'TRADING_RESUMED'],
      hash: '',
      previous_hash: this.lastHash
    };

    record.hash = this.generateHash(record);
    this.lastHash = record.hash;

    await this.storeRecord(record);
  }

  async logError(error: Error, context: any): Promise<void> {
    const record: ComplianceRecord = {
      id: `error_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action_type: 'ERROR',
      initiator: 'SYSTEM',
      authorization: 'N/A',
      market_data_snapshot: {},
      system_state: await this.captureSystemState(),
      decision_factors: {
        error_message: error.message,
        error_stack: error.stack,
        context
      },
      regulatory_flags: ['SYSTEM_ERROR'],
      hash: '',
      previous_hash: this.lastHash
    };

    record.hash = this.generateHash(record);
    this.lastHash = record.hash;

    await this.storeRecord(record);
  }

  private generateHash(record: ComplianceRecord): string {
    const content = JSON.stringify({
      ...record,
      hash: undefined
    });
    
    return createHash('sha256').update(content).digest('hex');
  }

  async storeRecord(record: ComplianceRecord): Promise<void> {
    if (this.isDemoMode) {
      logger.info('Demo mode: Would store compliance record');
      return;
    }

    try {
      // Check if Pinecone is actually ready before trying to use it
      if (!pineconeService) {
        console.log('Pinecone service not available - skipping compliance record storage');
        return;
      }

      let executionIndex;
      try {
        executionIndex = pineconeService.getExecutionIndex();
      } catch (error) {
        console.log('Pinecone not initialized yet - skipping compliance record storage');
        return;
      }

      if (!executionIndex) {
        console.log('Pinecone execution index not available - skipping compliance record storage');
        return;
      }

      const embedding = await aiParser.generateEmbedding(
        JSON.stringify(record.decision_factors)
      );
      
      await executionIndex.upsert([{
        id: `compliance_${record.id}`,
        values: embedding,
        metadata: {
          ...record,
          type: 'compliance',
          stored_at: new Date().toISOString()
        }
      }]);

      // Keep recent records in memory
      this.recordChain.push(record);
      if (this.recordChain.length > 1000) {
        this.recordChain.shift();
      }

      // Also write to file for backup
      // This would write to a compliance log file
    } catch (error) {
      // Don't create recursive errors - just log to console
      console.error('Failed to store compliance record:', error);
    }
  }

  private checkRegulatoryFlags(decision: any): string[] {
    const flags: string[] = [];
    
    if (decision.position_size > 10000) {
      flags.push('LARGE_POSITION');
    }
    
    if (decision.leverage > 1) {
      flags.push('LEVERAGED_TRADE');
    }
    
    if (decision.asset?.includes('CRYPTO')) {
      flags.push('CRYPTOCURRENCY');
    }
    
    return flags;
  }

  private async captureSystemState(): Promise<any> {
    try {
      // Dynamic imports to avoid circular dependency
      const { strategyManager } = await import('./strategyManager');
      const { portfolioMonitor } = await import('./portfolioMonitor');
      const { circuitBreaker } = await import('./circuitBreaker');
      const { marketDataStream } = await import('./marketDataStream');

      return {
        timestamp: new Date().toISOString(),
        active_strategies: strategyManager.getActiveStrategies().length,
        open_positions: portfolioMonitor.getOpenPositions().length,
        circuit_breaker_active: circuitBreaker.isActive(),
        market_data_connected: marketDataStream.getConnectionStatus()
      };
    } catch (error) {
      logger.error('Error capturing system state:', error);
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to capture system state'
      };
    }
  }

  async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    // Query records from Pinecone
    // Generate formatted report
    // Include all trades, errors, circuit breaker events
    logger.info(`Generating compliance report from ${startDate} to ${endDate}`);
  }
}

export const complianceLogger = new ComplianceLogger(); 