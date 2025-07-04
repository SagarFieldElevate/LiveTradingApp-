import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '../utils/logger';
import { Strategy, Position, ParsedStrategy } from '../types';
import { aiParser } from './aiParser';

export class PineconeService {
  private pinecone: Pinecone | null = null;
  private favoritesIndex: any;
  private executionIndex: any;
  private isInitialized = false;
  private isDemoMode = false;

  private getPineconeClient(): Pinecone {
    if (!this.pinecone) {
      if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY.trim() === '') {
        throw new Error('PINECONE_API_KEY environment variable is not set');
      }
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY!
      });
    }
    return this.pinecone;
  }

  getExecutionIndex() {
    if (!this.isInitialized && !this.isDemoMode) {
      throw new Error('PineconeService not initialized');
    }
    return this.executionIndex;
  }

  async initialize(): Promise<void> {
    try {
      // Check if API key is available
      if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY.trim() === '') {
        logger.warn('Pinecone API key not configured - running in demo mode');
        this.isDemoMode = true;
        this.isInitialized = true;
        return;
      }

      const pinecone = this.getPineconeClient();
      
      // Check required environment variables
      const favoritesIndexName = process.env.PINECONE_INDEX_FAVORITES || 'trading-favorites';
      const executionIndexName = process.env.PINECONE_INDEX_EXECUTION || 'trading-execution';
      
      logger.info(`🔧 Initializing Pinecone with indexes: ${favoritesIndexName}, ${executionIndexName}`);
      
      // Check and create indexes if they don't exist
      await this.ensureIndexExists(pinecone, favoritesIndexName);
      await this.ensureIndexExists(pinecone, executionIndexName);
      
      // Connect to both indexes
      this.favoritesIndex = pinecone.index(favoritesIndexName);
      this.executionIndex = pinecone.index(executionIndexName);
      
      logger.info('✅ Pinecone initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.warn('⚠️ Pinecone initialization failed, running in demo mode:', error);
      this.isDemoMode = true;
      this.isInitialized = true;
    }
  }

  private async ensureIndexExists(pinecone: Pinecone, indexName: string): Promise<void> {
    try {
      // Check if index exists
      const existingIndexes = await pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some(index => index.name === indexName);
      
      if (!indexExists) {
        logger.info(`📋 Creating Pinecone index: ${indexName}`);
        
        await pinecone.createIndex({
          name: indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        // Wait for index to be ready
        logger.info(`⏳ Waiting for index ${indexName} to be ready...`);
        let isReady = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max
        
        while (!isReady && attempts < maxAttempts) {
          try {
            const indexDescription = await pinecone.describeIndex(indexName);
            isReady = indexDescription.status?.ready === true;
            
            if (!isReady) {
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
              attempts++;
              logger.info(`⏳ Index ${indexName} not ready yet (${attempts}/${maxAttempts})...`);
            }
          } catch (error) {
            // Index might not be queryable yet
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
          }
        }
        
        if (isReady) {
          logger.info(`✅ Index ${indexName} created and ready`);
        } else {
          logger.warn(`⚠️ Index ${indexName} creation timeout - continuing anyway`);
        }
      } else {
        logger.info(`✅ Index ${indexName} already exists`);
      }
    } catch (error) {
      logger.error(`❌ Failed to ensure index ${indexName} exists:`, error);
      throw error;
    }
  }

  async getFavoritedStrategies(userId: string = 'default-user'): Promise<Strategy[]> {
    if (this.isDemoMode) {
      logger.warn('❌ Pinecone API key not configured - cannot load strategies');
      return [];
    }

    try {
      logger.info(`🔍 Querying Pinecone for strategies with userId: ${userId}`);
      
      // Query favorited strategies
      const queryResponse = await this.favoritesIndex.query({
        vector: new Array(1536).fill(0), // Dummy vector for metadata filtering
        filter: {
          user_id: { $eq: userId }
        },
        topK: 100,
        includeMetadata: true
      });

      logger.info(`📊 Pinecone query returned ${queryResponse.matches?.length || 0} matches`);
      
      if (queryResponse.matches && queryResponse.matches.length > 0) {
        // Log first strategy for debugging
        const firstMatch = queryResponse.matches[0];
        logger.info(`🔍 First strategy from Pinecone:`, {
          id: firstMatch.id,
          metadata_keys: firstMatch.metadata ? Object.keys(firstMatch.metadata) : 'no metadata',
          strategy_name: firstMatch.metadata?.strategy_name || 'no name',
          strategy_id: firstMatch.metadata?.strategy_id || 'no id'
        });
      }

      // Transform to Strategy objects
      const strategies = queryResponse.matches?.map((match: any) => {
        const metadata = match.metadata || {};
        
        // Generate readable strategy name from description
        let displayName = metadata.strategy_name;
        
        if (metadata.description && (displayName === metadata.strategy_id || !displayName || displayName.length < 10)) {
          // Extract strategy type from description
          const desc = metadata.description.toLowerCase();
          if (desc.includes('crude oil') && desc.includes('defi') && desc.includes('gold')) {
            displayName = '🛢️ Oil + DeFi + Gold → Bitcoin Strategy';
          } else if (desc.includes('qqq') && desc.includes('correlation')) {
            displayName = '📈 QQQ-Bitcoin Correlation Strategy';
          } else if (desc.includes('gold') && desc.includes('correlation')) {
            displayName = '🥇 Gold-Bitcoin Correlation Strategy';
          } else if (desc.includes('moving average')) {
            displayName = '📊 Moving Average Strategy';
          } else if (desc.includes('rsi')) {
            displayName = '📉 RSI Strategy';
          } else {
            // Extract first part of description as name
            const firstSentence = metadata.description.split('.')[0];
            displayName = firstSentence.length > 50 
              ? firstSentence.substring(0, 47) + '...'
              : firstSentence;
          }
        }
        
        return {
          id: match.id,
          strategy_id: metadata.strategy_id,
          strategy_name: displayName, // Use the generated readable name
          description: metadata.description,
          asset_1: metadata.asset_1 || 'BTC-USD',
          asset_2: metadata.asset_2 || 'USD',
          user_id: metadata.user_id,
          status: metadata.status || 'active',
          favorited_at: metadata.favorited_at,
          quality_score: metadata.quality_score,
          sharpe_ratio: metadata.sharpe_ratio,
          total_trades: metadata.total_trades,
          type: metadata.type || 'correlation'
        };
      }) || [];

      logger.info(`✅ Returning ${strategies.length} strategies to frontend`);
      
      // Log strategy names for debugging
      if (strategies.length > 0) {
        logger.info(`📋 Strategy names: ${strategies.map((s: any) => s.strategy_name || 'unnamed').join(', ')}`);
      }
      
      return strategies;
    } catch (error) {
      logger.error('❌ Failed to load strategies from Pinecone:', error);
      throw error;
    }
  }

  async saveStrategy(strategy: ParsedStrategy): Promise<void> {
    if (this.isDemoMode) {
      logger.info(`Demo mode: Would save strategy ${strategy.strategy_id}`);
      return;
    }

    try {
      // Generate embedding for strategy description
      const embedding = await this.generateEmbedding(strategy.description);
      
      // Prepare metadata - serialize complex objects as JSON strings
      const metadata: any = {
        // Basic fields (simple values)
        id: strategy.id,
        strategy_id: strategy.strategy_id,
        strategy_name: strategy.strategy_name,
        description: strategy.description,
        user_id: strategy.user_id,
        status: strategy.status,
        favorited_at: strategy.favorited_at,
        quality_score: strategy.quality_score,
        sharpe_ratio: strategy.sharpe_ratio,
        total_trades: strategy.total_trades,
        type: strategy.type,
        asset_1: strategy.asset_1,
        asset_2: strategy.asset_2,
        position_size: strategy.position_size,
        
        // Complex objects as JSON strings
        entry_conditions: JSON.stringify(strategy.entry_conditions),
        exit_conditions: JSON.stringify(strategy.exit_conditions),
        required_assets: JSON.stringify(strategy.required_assets),
        
        // Add timestamp
        updated_at: new Date().toISOString()
      };
      
      // Save to execution index
      await this.executionIndex.upsert([{
        id: `${strategy.user_id}_${strategy.strategy_id}`,
        values: embedding,
        metadata: metadata
      }]);

      logger.info(`Saved strategy ${strategy.strategy_id} to execution index`);
    } catch (error) {
      logger.error('Failed to save strategy:', error);
      throw error;
    }
  }

  async savePosition(position: Position): Promise<void> {
    if (this.isDemoMode) {
      logger.info(`Demo mode: Would save position ${position.id}`);
      return;
    }

    try {
      const positionText = `${position.asset} ${position.side} position at ${position.entry_price}`;
      const embedding = await this.generateEmbedding(positionText);
      
      // Prepare metadata with proper serialization
      const metadata: any = {
        // Simple values only
        id: position.id,
        strategy_id: position.strategy_id,
        asset: position.asset,
        side: position.side,
        entry_price: position.entry_price,
        current_price: position.current_price,
        quantity: position.quantity,
        trailing_stop_price: position.trailing_stop_price,
        take_profit_price: position.take_profit_price,
        status: position.status,
        entry_time: position.entry_time.toISOString(),
        type: 'position',
        updated_at: new Date().toISOString()
      };
      
      await this.executionIndex.upsert([{
        id: `position_${position.id}`,
        values: embedding,
        metadata: metadata
      }]);

      logger.info(`Saved position ${position.id}`);
    } catch (error) {
      logger.error('Failed to save position:', error);
      throw error;
    }
  }

  async getActivePositions(): Promise<Position[]> {
    if (this.isDemoMode) {
      logger.warn('❌ Pinecone API key not configured - cannot load positions');
      return [];
    }

    try {
      const queryResponse = await this.executionIndex.query({
        vector: new Array(1536).fill(0),
        filter: {
          type: { $eq: 'position' },
          status: { $eq: 'open' }
        },
        topK: 100,
        includeMetadata: true
      });

      return queryResponse.matches?.map((match: any) => match.metadata as any) || [];
    } catch (error) {
      logger.error('Failed to get positions:', error);
      throw error;
    }
  }

  async getActiveStrategies(): Promise<ParsedStrategy[]> {
    if (this.isDemoMode) {
      logger.warn('❌ Pinecone API key not configured - cannot load active strategies');
      return [];
    }

    try {
      logger.info('🔍 Loading existing strategies from execution index...');
      
      const queryResponse = await this.executionIndex.query({
        vector: new Array(1536).fill(0),
        filter: {
          // Don't filter by type since strategies might not have type field set
          status: { $in: ['active', 'paused'] } // Load both active and paused
        },
        topK: 100,
        includeMetadata: true
      });

      logger.info(`📊 Found ${queryResponse.matches?.length || 0} existing strategies in execution index`);

      const strategies = queryResponse.matches?.map((match: any) => {
        const metadata = match.metadata || {};
        
        // Parse JSON strings back to objects
        let entry_conditions = [];
        let exit_conditions = {};
        let required_assets = [];
        
        try {
          entry_conditions = metadata.entry_conditions ? JSON.parse(metadata.entry_conditions) : [];
          exit_conditions = metadata.exit_conditions ? JSON.parse(metadata.exit_conditions) : {};
          required_assets = metadata.required_assets ? JSON.parse(metadata.required_assets) : [];
        } catch (parseError) {
          logger.warn(`Failed to parse strategy metadata for ${metadata.strategy_id}:`, parseError);
        }
        
        return {
          id: metadata.id,
          strategy_id: metadata.strategy_id,
          strategy_name: metadata.strategy_name,
          description: metadata.description,
          asset_1: metadata.asset_1,
          asset_2: metadata.asset_2,
          user_id: metadata.user_id,
          status: metadata.status,
          favorited_at: metadata.favorited_at,
          quality_score: metadata.quality_score,
          sharpe_ratio: metadata.sharpe_ratio,
          total_trades: metadata.total_trades,
          type: metadata.type,
          position_size: metadata.position_size || 100,
          stop_loss_percent: metadata.stop_loss_percent,
          take_profit_percent: metadata.take_profit_percent,
          entry_conditions,
          exit_conditions,
          required_assets,
          approved_at: metadata.approved_at
        } as ParsedStrategy;
      }) || [];

      logger.info(`✅ Loaded ${strategies.length} strategies from execution index`);
      
      return strategies;
    } catch (error) {
      logger.error('❌ Failed to load strategies from execution index:', error);
      throw error;
    }
  }

  async fetchFavoriteStrategies(): Promise<Strategy[]> {
    // Alias for getFavoritedStrategies to match the interface
    return this.getFavoritedStrategies();
  }

  async updateStrategyStatus(strategyId: string, status: Strategy['status']): Promise<void> {
    if (this.isDemoMode) {
      logger.info(`Demo mode: Would update strategy ${strategyId} status to ${status}`);
      return;
    }
    // Implementation placeholder - will be expanded
    logger.info(`Updating strategy ${strategyId} status to ${status}`);
  }

  async logExecution(_executionData: any): Promise<void> {
    if (this.isDemoMode) {
      logger.info('Demo mode: Would log execution to Pinecone');
      return;
    }
    // Implementation placeholder - will be expanded
    logger.info('Logging execution to Pinecone');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use the AI Parser's embedding generation
    return aiParser.generateEmbedding(text);
  }
}

export const pineconeService = new PineconeService(); 