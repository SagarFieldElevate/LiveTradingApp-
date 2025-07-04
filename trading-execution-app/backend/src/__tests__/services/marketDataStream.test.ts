import { MarketDataStream } from '../../services/marketDataStream';
import WebSocket from 'ws';

jest.mock('ws');

describe('MarketDataStream', () => {
  let marketDataStream: MarketDataStream;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    marketDataStream = new MarketDataStream();
    mockWs = new WebSocket('') as jest.Mocked<WebSocket>;
    (WebSocket as jest.Mock).mockReturnValue(mockWs);
  });

  describe('data validation', () => {
    it('should reject quotes with invalid prices', () => {
      const invalidQuote = {
        symbol: 'BTC-USD',
        price: -100,
        bid: 50000,
        ask: 50100,
        timestamp: new Date(),
        volume: 100
      };

      const isValid = marketDataStream['validateQuote'](invalidQuote);
      expect(isValid).toBe(false);
    });

    it('should reject quotes with high spread', () => {
      const highSpreadQuote = {
        symbol: 'BTC-USD',
        price: 50000,
        bid: 49000,
        ask: 51000, // 4% spread
        timestamp: new Date(),
        volume: 100
      };

      const isValid = marketDataStream['validateQuote'](highSpreadQuote);
      expect(isValid).toBe(false);
    });

    it('should accept valid quotes', () => {
      const validQuote = {
        symbol: 'BTC-USD',
        price: 50000,
        bid: 49950,
        ask: 50050, // 0.2% spread
        timestamp: new Date(),
        volume: 100
      };

      const isValid = marketDataStream['validateQuote'](validQuote);
      expect(isValid).toBe(true);
    });
  });

  describe('disconnection handling', () => {
    it('should halt trading on disconnect', (done) => {
      marketDataStream.on('disconnected', () => {
        expect(marketDataStream.getConnectionStatus()).toBe(false);
        done();
      });

      marketDataStream['handleDisconnection']();
    });
  });
}); 