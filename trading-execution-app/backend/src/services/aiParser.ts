import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { Strategy, ParsedStrategy } from '../types';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

class AIParser {
  private openai: OpenAI | null = null;
  private isDemoMode = false;

  constructor() {
    // Initialize OpenAI if API key is available
    try {
      logger.info(`🔍 AI Parser checking environment: OPENAI_API_KEY = ${process.env.OPENAI_API_KEY ? 'Found (' + process.env.OPENAI_API_KEY.substring(0, 20) + '...)' : 'NOT FOUND'}`);
      
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.info('✅ AI Parser initialized with OpenAI API key');
      } else {
        logger.warn('⚠️ OpenAI API key not configured - AI Parser running in demo mode');
        this.isDemoMode = true;
      }
    } catch (error) {
      logger.warn('⚠️ Failed to initialize OpenAI, running in demo mode:', error);
      this.isDemoMode = true;
    }
  }

  async parseStrategy(strategyInput: Strategy | string, comments?: string): Promise<ParsedStrategy> {
    // Determine strategy text to parse
    const strategyText = typeof strategyInput === 'string' ? strategyInput : strategyInput.description;
    
    // Extract basic info from input
    const inputStrategy = typeof strategyInput !== 'string' ? strategyInput : null;
    const strategyId = inputStrategy?.strategy_id || `strategy_${Date.now()}`;
    const userId = inputStrategy?.user_id || 'default-user';

    if (this.isDemoMode) {
      logger.warn('AI Parser in demo mode - using demo parsing');
      // Return demo parsed strategy using description string
      return {
        id: strategyId,
        strategy_id: strategyId,
        strategy_name: 'Demo Parsed Strategy',
        description: strategyText,
        asset_1: 'BTC-USD',
        asset_2: 'ETH-USD',
        user_id: userId,
        status: 'pending',
        favorited_at: new Date().toISOString(),
        quality_score: 0.80,
        sharpe_ratio: 1.1,
        total_trades: 15,
        type: 'technical',
        entry_conditions: {
          type: 'technical_indicator',
          primary_asset: 'BTC-USD',
          threshold: 0.02,
          direction: 'up',
          timeframe: '1h'
        },
        exit_conditions: {
          stop_loss: {
            type: 'percentage',
            value: 0.05,
            is_trailing: true
          },
          take_profit: {
            type: 'percentage',
            value: 0.10
          }
        },
        required_assets: ['BTC-USD'],
        position_size: 100
      };
    }

    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      logger.info(`🧠 Parsing strategy with OpenAI: ${strategyText.substring(0, 100)}...`);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert trading strategy parser. Extract precise trading conditions from strategy descriptions.

CRITICAL: For multi-asset strategies with "WHEN A AND B AND C" patterns, use multi_asset_correlation type.

Return ONLY valid JSON with this structure:
{
  "strategy_name": "Clear strategy name",
  "entry_conditions": {
    "type": "multi_asset_correlation" | "single_correlation" | "technical_indicator",
    
    // FOR MULTI-ASSET (WHEN X AND Y AND Z):
    "triggers": [
      {"asset": "WTI_CRUDE_OIL", "direction": "up", "threshold_percent": null},
      {"asset": "SPY", "direction": "up", "threshold_percent": null},
      {"asset": "QQQ", "direction": "up", "threshold_percent": null}
    ],
    "target_asset": "BTC-USD",
    "action": "buy",
    "delay_days": 1,
    
    // FOR SINGLE ASSET:
    "primary_asset": "BTC-USD", 
    "threshold": 0.02,
    "direction": "up",
    "timeframe": "1d"
  },
  "exit_conditions": {
    "stop_loss": {
      "type": "percentage",
      "value": 2.0,
      "is_trailing": true
    },
    "take_profit": {
      "type": "percentage",
      "value": 3.0
    },
    "max_hold_days": 3
  },
  "required_assets": ["WTI_CRUDE_OIL", "SPY", "QQQ", "BTC-USD"],
  "position_size": 100
}

PARSING RULES:
- "WTI Crude Oil" → "WTI_CRUDE_OIL"
- "SPY Daily Close" → "SPY" 
- "QQQ Daily Close" → "QQQ"
- Look for stop loss percentages (e.g. "2.0x ATR" = 2.0)
- Look for take profit percentages (e.g. "3.0x ATR" = 3.0)
- Extract hold periods (e.g. "3 days maximum" = 3)
- If correlation mentioned, extract value (e.g. "r=0.92" = 0.92)`
          },
          {
            role: 'user',
            content: `Parse this trading strategy: "${strategyText}"${comments ? `\n\nAdditional clarifications: ${comments}` : ''}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info(`🧠 OpenAI response: ${response.substring(0, 200)}...`);

      const parsedData = JSON.parse(response);

      const strategy: ParsedStrategy = {
        id: strategyId,
        strategy_id: strategyId,
        strategy_name: parsedData.strategy_name || `Parsed Strategy ${strategyId}`,
        description: strategyText,
        user_id: userId,
        status: 'pending',
        favorited_at: inputStrategy?.favorited_at || new Date().toISOString(),
        quality_score: inputStrategy?.quality_score || 0.80,
        sharpe_ratio: inputStrategy?.sharpe_ratio || 1.1,
        total_trades: inputStrategy?.total_trades || 15,
        type: parsedData.type || 'correlation',
        asset_1: parsedData.required_assets?.[0] || 'BTC-USD',
        asset_2: parsedData.required_assets?.[1] || 'USD',
        entry_conditions: parsedData.entry_conditions,
        exit_conditions: parsedData.exit_conditions,
        required_assets: parsedData.required_assets || ['BTC-USD'],
        position_size: parsedData.position_size || 100
      };

      logger.info(`✅ Strategy parsed successfully: ${strategy.strategy_name}`);
      return strategy;
    } catch (error) {
      logger.error('❌ Failed to parse strategy with OpenAI:', error);
      
      // Fallback: Create reasonable parsed strategy from description
      logger.info('🔧 Using fallback parsing...');
      
      // Detect if this is a multi-asset strategy
      const isMultiAsset = strategyText.toLowerCase().includes(' and ') && 
                          (strategyText.includes('oil') || strategyText.includes('spy') || strategyText.includes('qqq'));
      
      const fallbackStrategy: ParsedStrategy = {
        id: strategyId,
        strategy_id: strategyId,
        strategy_name: this.extractStrategyName(strategyText),
        description: strategyText,
        user_id: userId,
        status: 'pending',
        favorited_at: inputStrategy?.favorited_at || new Date().toISOString(),
        quality_score: inputStrategy?.quality_score || 0.80,
        sharpe_ratio: inputStrategy?.sharpe_ratio || 1.1,
        total_trades: inputStrategy?.total_trades || 15,
        type: 'correlation',
        asset_1: 'BTC-USD',
        asset_2: 'USD',
        entry_conditions: isMultiAsset ? {
          type: 'multi_asset_correlation',
          triggers: [
            {asset: 'WTI_CRUDE_OIL', direction: 'up', threshold_percent: null},
            {asset: 'SPY', direction: 'up', threshold_percent: null},
            {asset: 'QQQ', direction: 'up', threshold_percent: null}
          ],
          target_asset: 'BTC-USD',
          action: 'buy',
          delay_days: 1
        } : {
          type: 'single_correlation',
          primary_asset: 'BTC-USD',
          threshold: 0.02,
          direction: 'up',
          timeframe: '1d'
        },
        exit_conditions: {
          stop_loss: {
            type: 'percentage',
            value: 2.0,
            is_trailing: true
          },
          take_profit: {
            type: 'percentage',
            value: 3.0
          },
          max_hold_days: 3
        },
        required_assets: isMultiAsset ? ['WTI_CRUDE_OIL', 'SPY', 'QQQ', 'BTC-USD'] : ['BTC-USD'],
        position_size: 100
      };
      
      return fallbackStrategy;
    }
  }

  private extractStrategyName(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('crude oil') && desc.includes('defi') && desc.includes('gold')) {
      return '🛢️ Oil + DeFi + Gold → Bitcoin Strategy';
    } else if (desc.includes('qqq') && desc.includes('correlation')) {
      return '📈 QQQ-Bitcoin Correlation Strategy';
    } else if (desc.includes('gold') && desc.includes('correlation')) {
      return '🥇 Gold-Bitcoin Correlation Strategy';
    } else {
      // Extract first meaningful part
      const firstSentence = description.split('.')[0];
      return firstSentence.length > 50 
        ? firstSentence.substring(0, 47) + '...'
        : firstSentence;
    }
  }

  private extractTrigger(description: string): string {
    if (description.includes('correlation')) {
      const match = description.match(/r=([0-9.]+)/);
      const correlation = match ? match[1] : '0.90';
      return `Strong correlation (r=${correlation}) movement trigger`;
    } else if (description.includes('>2%')) {
      return 'Price movement >2% in same direction';
    } else {
      return 'Multiple indicator alignment';
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.isDemoMode) {
      // Return demo embedding vector
      return new Array(1536).fill(0).map(() => Math.random() * 0.1);
    }

    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  async validateStrategy(strategy: Strategy): Promise<boolean> {
    if (this.isDemoMode) {
      logger.info(`Demo mode: Would validate strategy ${strategy.id}`);
      return true;
    }

    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a trading strategy validator. Analyze the strategy and return "VALID" or "INVALID" with a brief explanation.'
          },
          {
            role: 'user',
            content: JSON.stringify(strategy, null, 2)
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      });

      const response = completion.choices[0].message.content;
      const isValid = response?.toLowerCase().includes('valid');
      
      logger.info(`Strategy validation result: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid || false;
    } catch (error) {
      logger.error('Failed to validate strategy:', error);
      return false;
    }
  }
}

export const aiParser = new AIParser(); 