import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger';

interface CoinbaseAccount {
  uuid: string;
  name: string;
  currency: string;
  available_balance: {
    value: string;
    currency: string;
  };
  hold: {
    value: string;
    currency: string;
  };
}

interface CoinbaseProduct {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  volume_percentage_change_24h: string;
}

export class CoinbaseService {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseUrl = process.env.COINBASE_BASE_URL || 'https://api.prime.coinbase.com';

  constructor() {
    this.apiKey = process.env.COINBASE_API_KEY || '';
    this.apiSecret = process.env.COINBASE_API_SECRET || '';
    this.passphrase = process.env.COINBASE_PASSPHRASE || '';
  }

  private getRequestPath(endpoint: string): string {
    // Ensure leading slash
    return endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  }

  private generateSignature(timestamp: string, method: string, requestPath: string, body: string = ''): string {
    // Coinbase Prime signature: timestamp + method + requestPath (+ body if present)
    const message = timestamp + method.toUpperCase() + requestPath + body;
    // Use secret as plain string, not base64 decoded
    return crypto.createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
  }

  private getHeaders(method: string, requestPath: string, body: string = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.generateSignature(timestamp, method, requestPath, body);

    const headers: Record<string, string> = {
      'X-CB-ACCESS-KEY': this.apiKey,
      'X-CB-ACCESS-SIGNATURE': signature,
      'X-CB-ACCESS-TIMESTAMP': timestamp,
      'X-CB-ACCESS-PASSPHRASE': this.passphrase,
      'Accept': 'application/json'
    };

    return headers;
  }

  async getBalances(): Promise<any[]> {
    // Use Portfolio Balances endpoint - your $10k trading portfolio (CORRECT ENDPOINT!)
    if (!process.env.COINBASE_PORTFOLIO_ID) {
      throw new Error('COINBASE_PORTFOLIO_ID is required for trading portfolio access');
    }
    
    const endpoint = `/v1/portfolios/${process.env.COINBASE_PORTFOLIO_ID}/balances`;
    const requestPath = this.getRequestPath(endpoint);
    const headers = this.getHeaders('GET', requestPath);

    const response = await axios.get(`${this.baseUrl}${endpoint}`, { headers });
    
    // Extract balances from the response (CORRECT FORMAT!)
    const balances = response.data?.balances || [];
    const formattedBalances: any[] = [];
    
    for (const balance of balances) {
      const amount = parseFloat(balance.amount || '0');
      const hold = parseFloat(balance.holds || '0');
      const available = amount - hold;
      const fiatValue = parseFloat(balance.fiat_amount || '0');
      
      if (amount > 0) {
        formattedBalances.push({
          id: balance.symbol,
          currency: balance.symbol.toUpperCase(),
          balance: amount.toString(),
          available: available.toString(),
          notional_value: fiatValue > 0 ? fiatValue : amount, // Use fiat_amount if available
          hold: hold.toString(),
          wallet_type: 'TRADING'
        });
      }
    }
    
    return formattedBalances;
  }

  private getEstimatedPrice(symbol: string): number {
    // Simple price estimates for common currencies (for display purposes only)
    const estimates: Record<string, number> = {
      'BTC': 45000,
      'ETH': 2500,
      'DOGE': 0.17,
      'ADA': 0.60,
      'LINK': 14,
      'AAVE': 280,
      'AVAX': 19,
      'ALGO': 0.18
    };
    return estimates[symbol] || 0;
  }

  async getAccounts(): Promise<CoinbaseAccount[]> {
    try {
      // Use Prime API to list portfolios
      const requestPath = '/v1/portfolios';
      const headers = this.getHeaders('GET', requestPath);

      const response = await axios.get(`${this.baseUrl}${requestPath}`, { headers });

      // Transform portfolios response to match account interface
      const portfolios = response.data?.portfolios || [];
      return portfolios.map((portfolio: any) => ({
        uuid: portfolio.id,
        name: portfolio.name || 'Portfolio',
        currency: 'USD',
        available_balance: {
          value: '0', // Will be populated from balances
          currency: 'USD'
        },
        hold: {
          value: '0',
          currency: 'USD'
        }
      }));
    } catch (error) {
      logger.warn('Prime portfolios endpoint failed:', error);
      return [];
    }
  }

  async getPortfolio() {
    try {
      // Use trading portfolio wallet balances (your $10k portfolio)
      const balances = await this.getBalances();

      let totalValue = 0;
      let cashBalance = 0;
      const positions: any[] = [];

      for (const bal of balances) {
        const qty = parseFloat(bal.balance);
        const notionalValue = bal.notional_value || 0;
        const available = parseFloat(bal.available);
        const hold = parseFloat(bal.hold);
        
        if (qty === 0) continue;

        if (bal.currency === 'USD' || bal.currency === 'USDC') {
          cashBalance += notionalValue;
        } else {
          totalValue += notionalValue;
          
          const currentPrice = qty > 0 ? notionalValue / qty : 0;
          
          positions.push({
            id: bal.id || bal.currency,
            symbol: `${bal.currency}-USD`,
            currency: bal.currency,
            quantity: qty,
            available: available,
            hold: hold,
            current_price: currentPrice,
            value: notionalValue,
            name: bal.currency,
            wallet_type: bal.wallet_type || 'TRADING'
          });
        }
      }

      const grandTotal = totalValue + cashBalance;

      return {
        total_value: grandTotal,
        cash_balance: cashBalance,
        positions_value: totalValue,
        positions,
        open_positions: positions.length,
        daily_pnl: 0,
        account_count: positions.length,
        portfolio_type: 'TRADING'
      };
    } catch (error) {
      logger.error('Failed to get Coinbase trading portfolio:', error);
      throw error;
    }
  }

  async getPrice(productId: string): Promise<number> {
    try {
      // Prime API products endpoint
      const requestPath = `/v1/products/${productId}`;
      const headers = this.getHeaders('GET', requestPath);

      const response = await axios.get(`${this.baseUrl}${requestPath}`, { headers });
      
      const price = parseFloat(response.data?.price || response.data?.quote?.USD || '0');
      return price;
    } catch (error: any) {
      logger.error(`Failed to get price for ${productId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getProducts(): Promise<CoinbaseProduct[]> {
    try {
      // Prime API products endpoint
      const requestPath = '/v1/products';
      const headers = this.getHeaders('GET', requestPath);

      const response = await axios.get(`${this.baseUrl}${requestPath}`, { headers });
      
      return response.data?.products || [];
    } catch (error: any) {
      logger.error('Failed to get Coinbase products:', error.response?.data || error.message);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.passphrase);
  }
}

export const coinbaseService = new CoinbaseService(); 