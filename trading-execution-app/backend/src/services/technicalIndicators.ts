import { logger } from '../utils/logger';
import { polygonService } from './polygonService';

interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalIndicators {
  private priceHistory: Map<string, PriceData[]> = new Map();
  private readonly MAX_HISTORY = 1000; // Keep last 1000 candles
  private readonly TRADITIONAL_ASSETS = ['WTI_CRUDE_OIL', 'GOLD', 'SPY', 'QQQ', 'AAPL', 'MSFT'];

  addPriceData(symbol: string, data: PriceData) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(data);

    // Maintain max history
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  async calculateATR(symbol: string, period: number = 14): Promise<number> {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < period + 1) {
      throw new Error(`Insufficient data for ATR calculation: ${symbol}`);
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      const previous = history[i - 1];
      
      const highLow = current.high - current.low;
      const highPrevClose = Math.abs(current.high - previous.close);
      const lowPrevClose = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(highLow, highPrevClose, lowPrevClose);
      trueRanges.push(trueRange);
    }

    // Calculate ATR
    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / period;

    return atr;
  }

  async calculateCorrelation(asset1: string, asset2: string, period: number = 20): Promise<number> {
    const history1 = this.priceHistory.get(asset1);
    const history2 = this.priceHistory.get(asset2);

    if (!history1 || !history2 || history1.length < period || history2.length < period) {
      throw new Error('Insufficient data for correlation calculation');
    }

    // Get recent closes
    const closes1 = history1.slice(-period).map(p => p.close);
    const closes2 = history2.slice(-period).map(p => p.close);

    // Calculate returns
    const returns1: number[] = [];
    const returns2: number[] = [];
    
    for (let i = 1; i < closes1.length; i++) {
      returns1.push((closes1[i] - closes1[i-1]) / closes1[i-1]);
      returns2.push((closes2[i] - closes2[i-1]) / closes2[i-1]);
    }

    // Calculate correlation
    const mean1 = returns1.reduce((a, b) => a + b) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b) / returns2.length;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const correlation = numerator / Math.sqrt(denominator1 * denominator2);
    return correlation;
  }

  async getPercentageMove(symbol: string, timeframe: string): Promise<number> {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      throw new Error(`No price data for ${symbol}`);
    }

    const currentPrice = history[history.length - 1].close;
    let comparePrice: number;

    // Get price from timeframe ago
    const now = new Date();
    let hoursAgo: number;

    switch(timeframe) {
      case '1h': hoursAgo = 1; break;
      case '4h': hoursAgo = 4; break;
      case '1d': hoursAgo = 24; break;
      default: hoursAgo = 1;
    }

    const compareTime = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    // Find closest price to compare time
    const compareData = history.find(p => 
      Math.abs(p.timestamp.getTime() - compareTime.getTime()) < 60000 // Within 1 minute
    );

    if (!compareData) {
      // Use oldest available if we don't have enough history
      comparePrice = history[0].close;
    } else {
      comparePrice = compareData.close;
    }

    return ((currentPrice - comparePrice) / comparePrice) * 100;
  }

  async getCurrentPriceAsync(symbol: string): Promise<number | null> {
    // Check if we have recent cached data first
    const history = this.priceHistory.get(symbol);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const age = (new Date().getTime() - latest.timestamp.getTime()) / 1000;
      
      // If data is fresh (less than 10 seconds old), use it
      if (age <= 10) {
        return latest.close;
      }
    }

    // For traditional assets, fetch from Polygon
    if (this.TRADITIONAL_ASSETS.includes(symbol)) {
      try {
        const quote = await polygonService.fetchQuote(symbol);
        if (quote && quote.price) {
          // Add to price history for future calculations
          this.addPriceData(symbol, {
            timestamp: quote.timestamp,
            open: quote.price,
            high: quote.price,
            low: quote.price,
            close: quote.price,
            volume: 0
          });
          return quote.price;
        }
      } catch (error) {
        logger.error(`Failed to fetch ${symbol} price from Polygon:`, error);
      }
    }

    // For crypto assets, return cached value or null
    return history && history.length > 0 ? history[history.length - 1].close : null;
  }

  // Synchronous version for backwards compatibility
  getCurrentPrice(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1].close;
  }

  getSpread(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      return null;
    }
    
    const latest = history[history.length - 1];
    // Approximate spread from high-low
    return ((latest.high - latest.low) / latest.close) * 100;
  }

  // Helper to check data freshness
  isDataFresh(symbol: string, maxAgeSeconds: number = 5): boolean {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      return false;
    }

    const latest = history[history.length - 1];
    const age = (new Date().getTime() - latest.timestamp.getTime()) / 1000;
    
    return age <= maxAgeSeconds;
  }

  async ensurePriceData(symbol: string): Promise<boolean> {
    const currentPrice = await this.getCurrentPriceAsync(symbol);
    return currentPrice !== null;
  }
}

export const technicalIndicators = new TechnicalIndicators(); 