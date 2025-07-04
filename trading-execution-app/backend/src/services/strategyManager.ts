import { pineconeService } from './pineconeService';
import { aiParser } from './aiParser';
import { logger } from '../utils/logger';
import { Strategy, ParsedStrategy } from '../types';
import { io } from '../index';

export class StrategyManager {
  private strategies: Map<string, ParsedStrategy> = new Map();
  private activeStrategies: Set<string> = new Set();

  async initialize() {
    logger.info('Initializing Strategy Manager');
    await this.loadStrategies();
  }

  async loadStrategies() {
    try {
      // 1. Load previously approved/active strategies from execution index
      logger.info('Loading existing strategies from execution index...');
      const existingStrategies = await pineconeService.getActiveStrategies();
      
      for (const strategy of existingStrategies) {
        this.strategies.set(strategy.strategy_id, strategy);
        if (strategy.status === 'active') {
          this.activeStrategies.add(strategy.strategy_id);
        }
        logger.info(`Restored strategy: ${strategy.strategy_name} (${strategy.status})`);
      }
      
      logger.info(`Restored ${existingStrategies.length} existing strategies`);

      // 2. Load new strategies from Pinecone favorites that need approval
      const favoritedStrategies = await pineconeService.getFavoritedStrategies();
      
      // Filter strategies that need approval (not already loaded)
      const pendingStrategies = favoritedStrategies.filter(s => 
        !this.strategies.has(s.strategy_id)
      );

      logger.info(`Found ${pendingStrategies.length} new strategies for approval`);

      // Parse each new strategy
      for (const strategy of pendingStrategies) {
        try {
          const parsed = await aiParser.parseStrategy(strategy);
          if (parsed) {
            this.strategies.set(strategy.strategy_id, {
              ...parsed,
              status: 'pending'
            } as ParsedStrategy);

            // Notify frontend of new strategy
            io.emit('strategy:new', parsed);
          }
        } catch (error) {
          logger.error(`Failed to parse strategy ${strategy.strategy_id}:`, error);
        }
      }

      logger.info(`Strategy Manager loaded: ${this.strategies.size} total strategies, ${this.activeStrategies.size} active`);
    } catch (error) {
      logger.error('Failed to load strategies:', error);
      throw error;
    }
  }

  async approveStrategy(
    strategyId: string, 
    modifications: {
      stop_loss_percent: number;
      take_profit_percent: number;
      position_size?: number;
    }
  ): Promise<ParsedStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Validate stop loss is set
    if (!modifications.stop_loss_percent || modifications.stop_loss_percent <= 0) {
      throw new Error('Stop loss is required and must be greater than 0');
    }

    // Update strategy with modifications
    const approvedStrategy: ParsedStrategy = {
      ...strategy,
      stop_loss_percent: modifications.stop_loss_percent,
      take_profit_percent: modifications.take_profit_percent,
      position_size: modifications.position_size || 100,
      status: 'active',
      approved_at: new Date().toISOString()
    };

    // Save to Pinecone
    await pineconeService.saveStrategy(approvedStrategy);

    // Update local state
    this.strategies.set(strategyId, approvedStrategy);
    this.activeStrategies.add(strategyId);

    // Notify systems
    io.emit('strategy:approved', approvedStrategy);
    logger.info(`Strategy ${strategyId} approved and activated`);

    return approvedStrategy;
  }

  async editStrategy(
    strategyId: string, 
    modifications: {
      stop_loss_percent: number;
      take_profit_percent: number;
      position_size?: number;
    }
  ): Promise<ParsedStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Validate stop loss is set
    if (!modifications.stop_loss_percent || modifications.stop_loss_percent <= 0) {
      throw new Error('Stop loss is required and must be greater than 0');
    }

    // Update strategy with modifications
    const updatedStrategy: ParsedStrategy = {
      ...strategy,
      stop_loss_percent: modifications.stop_loss_percent,
      take_profit_percent: modifications.take_profit_percent,
      position_size: modifications.position_size || strategy.position_size || 100,
      // Keep existing status and approval date
    };

    // Save to Pinecone
    await pineconeService.saveStrategy(updatedStrategy);

    // Update local state
    this.strategies.set(strategyId, updatedStrategy);

    // Notify systems
    io.emit('strategy:updated', updatedStrategy);
    logger.info(`Strategy ${strategyId} parameters updated`);

    return updatedStrategy;
  }

  async pauseStrategy(strategyId: string) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    strategy.status = 'paused';
    this.activeStrategies.delete(strategyId);
    
    await pineconeService.saveStrategy(strategy);
    io.emit('strategy:paused', strategyId);
    
    logger.info(`Strategy ${strategyId} paused`);
  }

  async resumeStrategy(strategyId: string) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    strategy.status = 'active';
    this.activeStrategies.add(strategyId);
    
    await pineconeService.saveStrategy(strategy);
    io.emit('strategy:resumed', strategyId);
    
    logger.info(`Strategy ${strategyId} resumed`);
  }

  getActiveStrategies(): ParsedStrategy[] {
    return Array.from(this.activeStrategies)
      .map(id => this.strategies.get(id))
      .filter(s => s !== undefined) as ParsedStrategy[];
  }

  getStrategy(strategyId: string): ParsedStrategy | undefined {
    return this.strategies.get(strategyId);
  }

  getAllStrategies(): ParsedStrategy[] {
    return Array.from(this.strategies.values());
  }

  async reparseStrategy(strategyId: string, comments: string): Promise<ParsedStrategy> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error('Strategy not found');
    }

    // Re-parse with comments
    const reparsed = await aiParser.parseStrategy(strategy, comments);
    
    // Update local copy
    this.strategies.set(strategyId, {
      ...reparsed,
      status: 'pending'
    } as ParsedStrategy);

    // Notify frontend
    io.emit('strategy:reparsed', reparsed);
    
    return reparsed;
  }

  stop(): void {
    // No longer needed with new implementation
  }
}

export const strategyManager = new StrategyManager(); 