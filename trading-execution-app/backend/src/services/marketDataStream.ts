import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { io } from '../index';
import { technicalIndicators } from './technicalIndicators';
import { tradeHistoryService } from './tradeHistoryService';
import { EventEmitter } from 'events';

interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  timestamp: Date;
  volume: number;
  sequence?: number;
}

interface CoinbaseTickerMessage {
  type: 'ticker';
  sequence: number;
  product_id: string;
  price: string;
  open_24h: string;
  volume_24h: string;
  low_24h: string;
  high_24h: string;
  volume_30d: string;
  best_bid: string;
  best_ask: string;
  side: 'buy' | 'sell';
  time: string;
  trade_id: number;
  last_size: string;
}

export class MarketDataStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private isConnected = false;
  private lastQuotes: Map<string, MarketQuote> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = Date.now();

  async initialize() {
    await this.connect();
  }

  async connect(): Promise<void> {
    try {
      logger.info('🏦 Connecting to Coinbase WebSocket feed...');
      
      this.ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      
      this.ws.on('open', () => {
        logger.info('✅ Connected to Coinbase WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to existing symbols
        if (this.subscribedSymbols.size > 0) {
          this.subscribeToWebSocket();
        }
        
        // Auto-subscribe to major crypto pairs
        this.subscribeToAssets(['BTC-USD', 'ETH-USD', 'DOGE-USD', 'ADA-USD', 'LINK-USD']);
        
        // Start heartbeat monitoring
        this.startHeartbeat();
        
        // Notify UI
        io.emit('market:connected');
        logger.info('📡 Sent market:connected event to frontend');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('❌ WebSocket error:', error);
        this.handleDisconnection();
      });

      this.ws.on('close', (code, reason) => {
        logger.warn(`📱 WebSocket closed: ${code} - ${reason}`);
        this.handleDisconnection();
      });

    } catch (error) {
      logger.error('❌ Failed to connect to Coinbase WebSocket:', error);
      this.handleDisconnection();
    }
  }

  private subscribeToWebSocket() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not ready for subscription');
      return;
    }

    const productIds = Array.from(this.subscribedSymbols).map(symbol => 
      symbol.includes('-') ? symbol : `${symbol}-USD`
    );

    const subscribeMessage = {
      type: 'subscribe',
      channels: ['ticker'],
      product_ids: productIds
    };

    logger.info(`📊 Subscribing to ${productIds.length} products: ${productIds.join(', ')}`);
    this.ws.send(JSON.stringify(subscribeMessage));
  }

  private handleMessage(message: any) {
    this.lastHeartbeat = Date.now();

    if (message.type === 'subscriptions') {
      logger.info('📋 Subscription confirmed:', message.channels);
      return;
    }

    if (message.type === 'ticker') {
      this.processTickerMessage(message as CoinbaseTickerMessage);
      return;
    }

    if (message.type === 'heartbeat') {
      // Coinbase sends heartbeat messages
      return;
    }

    if (message.type === 'error') {
      logger.error('📱 WebSocket error message:', message);
      return;
    }
  }

  private processTickerMessage(ticker: CoinbaseTickerMessage) {
    const symbol = ticker.product_id.replace('-USD', ''); // Convert BTC-USD to BTC
    const price = parseFloat(ticker.price);
    const bid = parseFloat(ticker.best_bid);
    const ask = parseFloat(ticker.best_ask);
    const volume = parseFloat(ticker.volume_24h);

    const marketQuote: MarketQuote = {
      symbol: symbol,
      price: price,
      bid: bid,
      ask: ask,
      timestamp: new Date(ticker.time),
      volume: volume,
      sequence: ticker.sequence
    };

    // Validate data quality
    if (!this.validateQuote(marketQuote)) {
      logger.warn(`Invalid ticker data for ${ticker.product_id}`);
      return;
    }

    // Store latest quote
    this.lastQuotes.set(symbol, marketQuote);

    // Update technical indicators
    technicalIndicators.addPriceData(symbol, {
      timestamp: marketQuote.timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: volume
    });

    // Record market data to database (async, non-blocking)
    tradeHistoryService.recordMarketData(
      symbol, 
      price, 
      bid, 
      ask, 
      volume, 
      ticker.sequence, 
      'coinbase'
    ).catch(error => {
      // Don't log every error to avoid spam, just sample
      if (Math.random() < 0.01) {
        logger.error('Failed to record market data:', error);
      }
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

    // Check bid/ask spread is reasonable (not more than 10%)
    const spread = (quote.ask - quote.bid) / quote.price;
    if (spread > 0.1) {
      logger.warn(`Unusually wide spread for ${quote.symbol}: ${(spread * 100).toFixed(2)}%`);
    }

    return true;
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      // If no message received in 30 seconds, consider connection stale
      if (timeSinceLastHeartbeat > 30000) {
        logger.warn('❤️ No heartbeat received, connection may be stale');
        this.handleDisconnection();
      }
    }, 10000); // Check every 10 seconds
  }

  async subscribeToAssets(symbols: string[]) {
    const newSymbols = symbols.filter(s => !this.subscribedSymbols.has(s));
    if (newSymbols.length === 0) return;

    // Add to subscribed symbols
    newSymbols.forEach(s => this.subscribedSymbols.add(s));
    
    logger.info(`📊 Subscribed to: ${newSymbols.join(', ')}`);
    
    // Subscribe via WebSocket if connected
    if (this.isConnected) {
      this.subscribeToWebSocket();
    }
  }

  async unsubscribeFromSymbol(symbol: string) {
    if (!this.subscribedSymbols.has(symbol)) return;

    this.subscribedSymbols.delete(symbol);
    this.lastQuotes.delete(symbol);
    
    logger.info(`📊 Unsubscribed from: ${symbol}`);
    
    // Send unsubscribe message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const productId = symbol.includes('-') ? symbol : `${symbol}-USD`;
      const unsubscribeMessage = {
        type: 'unsubscribe',
        channels: ['ticker'],
        product_ids: [productId]
      };
      
      this.ws.send(JSON.stringify(unsubscribeMessage));
    }
  }

  private handleDisconnection() {
    this.isConnected = false;
    
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close WebSocket if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    // CRITICAL: Notify all systems immediately
    this.emit('disconnected');
    io.emit('market:disconnected');
    
    // Clear all quotes - DO NOT USE CACHED DATA
    this.lastQuotes.clear();
    
    logger.error('CRITICAL: Market data disconnected - All trading halted');
    
    // Attempt reconnection with exponential backoff
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      this.reconnectAttempts++;
      
      logger.info(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      logger.error('❌ Max reconnection attempts reached - manual intervention required');
    }
  }

  getLatestQuote(symbol: string): MarketQuote | null {
    return this.lastQuotes.get(symbol) || null;
  }

  isSymbolActive(symbol: string): boolean {
    const quote = this.lastQuotes.get(symbol);
    if (!quote) return false;
    
    const age = Date.now() - quote.timestamp.getTime();
    return age < 5000; // Active if updated within 5 seconds (real-time)
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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.lastQuotes.clear();
    
    logger.info('🔌 Disconnected from Coinbase WebSocket');
  }

  getCurrentPrices(): Map<string, MarketQuote> {
    return new Map(this.lastQuotes);
  }

  // Get current price with real-time data
  async getCurrentPrice(symbol: string): Promise<number | null> {
    const quote = this.lastQuotes.get(symbol);
    if (quote) {
      const age = Date.now() - quote.timestamp.getTime();
      // Real-time data should be very fresh
      if (age < 5000) {
        return quote.price;
      }
    }
    
    // If no recent data, return null (don't fallback to HTTP)
    return null;
  }
}

export const marketDataStream = new MarketDataStream(); 