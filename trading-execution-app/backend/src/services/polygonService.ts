import https from 'https';
import { logger } from '../utils/logger';

interface PolygonQuote {
  symbol: string;
  price: number;
  timestamp: Date;
  status: string;
}

export class PolygonService {
  private apiKey: string | null = null;
  private isInitialized = false;

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || null;
  }

  async initialize(): Promise<void> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      logger.warn('🔶 Polygon API key not configured - skipping Polygon integration');
      return;
    }

    try {
      // Test the API key with a simple request
      const testQuote = await this.fetchQuote('AAPL');
      if (testQuote) {
        this.isInitialized = true;
        logger.info('✅ Polygon API initialized successfully');
      } else {
        logger.warn('⚠️ Polygon API test failed - API key may be invalid');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize Polygon API:', error);
    }
  }

  async fetchQuote(symbol: string): Promise<PolygonQuote | null> {
    if (!this.isInitialized || !this.apiKey) {
      logger.warn(`Polygon API not initialized - cannot fetch ${symbol}`);
      return null;
    }

    return new Promise((resolve) => {
      // Map asset names to Polygon symbols
      const symbolMap: { [key: string]: string } = {
        'WTI_CRUDE_OIL': 'CL',   // WTI Crude Oil futures
        'GOLD': 'GC',            // Gold futures  
        'SPY': 'SPY',            // S&P 500 ETF
        'QQQ': 'QQQ',            // Nasdaq ETF
        'AAPL': 'AAPL',          // Apple stock (for testing)
        'MSFT': 'MSFT'           // Microsoft stock
      };

      const polygonSymbol = symbolMap[symbol] || symbol;
      
      const options = {
        hostname: 'api.polygon.io',
        port: 443,
        path: `/v2/aggs/ticker/${polygonSymbol}/prev?adjusted=true&apikey=${this.apiKey}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(data);
              
              if (result.results && result.results.length > 0) {
                const quote = result.results[0];
                resolve({
                  symbol: symbol,
                  price: quote.c, // Close price
                  timestamp: new Date(quote.t), // Timestamp
                  status: 'OK'
                });
              } else {
                logger.warn(`No data returned for ${symbol} from Polygon`);
                resolve(null);
              }
            } catch (error) {
              logger.error(`Error parsing Polygon response for ${symbol}:`, error);
              resolve(null);
            }
          } else {
            logger.warn(`Polygon API error for ${symbol}: ${res.statusCode}`);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`Polygon request error for ${symbol}:`, error);
        resolve(null);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  async fetchMultipleQuotes(symbols: string[]): Promise<{ [symbol: string]: PolygonQuote | null }> {
    const results: { [symbol: string]: PolygonQuote | null } = {};
    
    // Fetch all quotes in parallel
    const promises = symbols.map(async (symbol) => {
      const quote = await this.fetchQuote(symbol);
      results[symbol] = quote;
    });

    await Promise.all(promises);
    return results;
  }

  // Special handling for DEFILLAMA_DEX_VOLUME (this isn't a direct price)
  async fetchDeFiData(metric: string): Promise<number | null> {
    // DeFiLlama data would need a separate API call
    // For now, return a placeholder value
    logger.info(`DeFi data for ${metric} - using placeholder`);
    return 1234567890; // Placeholder DEX volume
  }

  isAvailable(): boolean {
    return this.isInitialized;
  }

  getAssetMapping(): { [key: string]: string } {
    return {
      'WTI_CRUDE_OIL': 'CL',
      'GOLD': 'GC',
      'SPY': 'SPY',
      'QQQ': 'QQQ'
    };
  }
}

export const polygonService = new PolygonService(); 