import https from 'https';
import { logger } from '../utils/logger';
import { io } from '../index';
import { technicalIndicators } from './technicalIndicators';
import { EventEmitter } from 'events';

interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: Date;
  volume: number;
}

export class MarketDataStream extends EventEmitter {
  private pollingInterval: NodeJS.Timeout | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private isConnected = false;
  private lastQuotes: Map<string, MarketQuote> = new Map();
  private pollingRate = 2000; // 2 seconds for real-time feel

  async initialize() {
    await this.connect();
  }

  async connect(): Promise<void> {
    try {
      logger.info('🏦 Connecting to Coinbase Public API...');
      
      // Test connection with a simple request
      const testPrice = await this.fetchPrice('BTC');
      logger.info(`🧪 Test fetch result: ${testPrice}`);
      
      if (testPrice) {
        this.isConnected = true;
        logger.info('✅ Connected to Coinbase Public API successfully');
        
        // Auto-subscribe to major crypto pairs for immediate data
        await this.subscribeToAssets(['BTC', 'ETH', 'DOGE', 'ADA', 'LINK']);
        
        // Start polling for subscribed symbols
        this.startPolling();
        
        // Notify UI
        io.emit('market:connected');
        logger.info('📡 Sent market:connected event to frontend');
      } else {
        throw new Error('Failed to fetch test price - API may be down');
      }

    } catch (error) {
      logger.error('❌ Failed to connect to Coinbase API:', error);
      this.handleDisconnection();
    }
  }

  private startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      if (this.subscribedSymbols.size === 0) return;

      try {
        // Fetch prices for all subscribed symbols
        await this.updateAllPrices();
      } catch (error) {
        logger.error('Error updating market prices:', error);
        this.handleDisconnection();
      }
    }, this.pollingRate);

    logger.info(`📈 Started polling ${this.subscribedSymbols.size} symbols every ${this.pollingRate}ms`);
  }

  private async updateAllPrices() {
    const symbols = Array.from(this.subscribedSymbols);
    const promises = symbols.map(symbol => this.fetchPrice(symbol));
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const symbol = symbols[index];
        this.processQuote(symbol, result.value);
      }
    });
  }

  private async fetchPrice(symbol: string): Promise<number | null> {
    return new Promise((resolve) => {
      // Convert symbol format (e.g., BTC -> BTC-USD)
      const coinbasePair = symbol.includes('-') ? symbol : `${symbol}-USD`;
      
      const options = {
        hostname: 'api.coinbase.com',
        port: 443,
        path: `/v2/prices/${coinbasePair}/spot`,
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
              const price = parseFloat(result.data.amount);
              resolve(price);
            } catch (error) {
              logger.error(`Error parsing price for ${symbol}:`, error);
              resolve(null);
            }
          } else {
            logger.warn(`Failed to fetch price for ${symbol}: ${res.statusCode}`);
            resolve(null);
          }
        });
      });

      req.on('error', (error) => {
        logger.error(`Request error for ${symbol}:`, error);
        resolve(null);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });

      req.end();
    });
  }

  private processQuote(symbol: string, price: number) {
    // Create market quote with estimated bid/ask spread
    const spread = price * 0.001; // 0.1% spread estimate for crypto
    const bid = price - spread / 2;
    const ask = price + spread / 2;

    const marketQuote: MarketQuote = {
      symbol: symbol,
      price: price,
      bid: bid,
      ask: ask,
      timestamp: new Date(),
      volume: 0 // Volume not available from Coinbase spot price API
    };

    // Validate data quality
    if (!this.validateQuote(marketQuote)) {
      logger.warn(`Invalid quote data for ${marketQuote.symbol}`);
      return;
    }

    // Store latest quote
    this.lastQuotes.set(marketQuote.symbol, marketQuote);

    // Update technical indicators
    technicalIndicators.addPriceData(marketQuote.symbol, {
      timestamp: marketQuote.timestamp,
      open: marketQuote.price,
      high: marketQuote.price,
      low: marketQuote.price,
      close: marketQuote.price,
      volume: marketQuote.volume
    });

    // Emit events
    this.emit('quote', marketQuote);
    io.emit('market:quote', marketQuote);
  }

  private validateQuote(quote: MarketQuote): boolean {
    // Data quality checks
    if (quote.price <= 0 || quote.bid <= 0 || quote.ask <= 0) {
      return false;
    }

    // Check for reasonable price (not NaN or Infinity)
    if (!Number.isFinite(quote.price)) {
      return false;
    }

    return true;
  }

  async subscribeToAssets(symbols: string[]) {
    const newSymbols = symbols.filter(s => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) return;

    // Add to subscribed symbols
    newSymbols.forEach(s => this.subscribedSymbols.add(s));
    
    logger.info(`📊 Subscribed to: ${newSymbols.join(', ')}`);
    
    // Fetch initial prices immediately
    await this.updateAllPrices();
    
    // Restart polling with new symbols if connected
    if (this.isConnected) {
      this.startPolling();
    }
  }

  async unsubscribeFromSymbol(symbol: string) {
    if (!this.subscribedSymbols.has(symbol)) return;

    this.subscribedSymbols.delete(symbol);
    this.lastQuotes.delete(symbol);
    
    logger.info(`📊 Unsubscribed from: ${symbol}`);
    
    // Restart polling if still have symbols
    if (this.subscribedSymbols.size > 0 && this.isConnected) {
      this.startPolling();
    }
  }

  private handleDisconnection() {
    this.isConnected = false;
    
    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // CRITICAL: Notify all systems immediately
    this.emit('disconnected');
    io.emit('market:disconnected');
    
    // Clear all quotes - DO NOT USE CACHED DATA
    this.lastQuotes.clear();
    
    logger.error('CRITICAL: Market data disconnected - All trading halted');
    
    // Attempt reconnection after 5 seconds
    setTimeout(() => {
      logger.info('🔄 Attempting to reconnect to Coinbase API...');
      this.connect();
    }, 5000);
  }

  getLatestQuote(symbol: string): MarketQuote | null {
    return this.lastQuotes.get(symbol) || null;
  }

  isSymbolActive(symbol: string): boolean {
    const quote = this.lastQuotes.get(symbol);
    if (!quote) return false;
    
    const age = Date.now() - quote.timestamp.getTime();
    return age < 10000; // Active if updated within 10 seconds (polling based)
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  subscribe(symbol: string, callback: (data: any) => void): void {
    // Legacy method for compatibility
    this.on('quote', (quote: MarketQuote) => {
      if (quote.symbol === symbol) {
        callback(quote);
      }
    });
  }

  unsubscribe(symbol: string, callback: (data: any) => void): void {
    // Legacy method for compatibility
    this.removeListener('quote', callback);
  }

  stop() {
    this.disconnect();
  }

  disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.lastQuotes.clear();
    
    logger.info('🔌 Disconnected from Coinbase market data');
  }

  getCurrentPrices(): Map<string, MarketQuote> {
    return new Map(this.lastQuotes);
  }

  // New method to get multiple prices at once
  async getCurrentPrice(symbol: string): Promise<number | null> {
    if (this.lastQuotes.has(symbol)) {
      const quote = this.lastQuotes.get(symbol);
      const age = Date.now() - quote!.timestamp.getTime();
      
      // If recent, return cached price
      if (age < 5000) {
        return quote!.price;
      }
    }
    
    // Otherwise fetch fresh price
    return await this.fetchPrice(symbol);
  }
}

export const marketDataStream = new MarketDataStream(); 