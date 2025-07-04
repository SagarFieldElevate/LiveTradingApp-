import request from 'supertest';
import { app } from '../../index';
import { marketDataStream } from '../../services/marketDataStream';
import { portfolioMonitor } from '../../services/portfolioMonitor';

describe('Trading API Integration', () => {
  beforeAll(async () => {
    // Initialize services
    await marketDataStream.connect();
    await portfolioMonitor.initialize();
  });

  afterAll(async () => {
    // Cleanup
    marketDataStream.disconnect();
  });

  describe('POST /api/trading/emergency/close-all', () => {
    it('should reject without auth code', async () => {
      const response = await request(app)
        .post('/api/trading/emergency/close-all')
        .send({ reason: 'Test' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should accept with valid auth code', async () => {
      process.env.EMERGENCY_AUTH_CODE = 'TEST-CODE';

      const response = await request(app)
        .post('/api/trading/emergency/close-all')
        .send({ 
          reason: 'Test',
          auth_code: 'TEST-CODE'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Emergency close initiated');
    });
  });

  describe('GET /api/trading/portfolio', () => {
    it('should return portfolio data', async () => {
      const response = await request(app)
        .get('/api/trading/portfolio');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_value');
      expect(response.body).toHaveProperty('open_positions');
      expect(response.body).toHaveProperty('daily_pnl');
    });
  });
}); 