import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { StrategyManager } from '../../services/strategyManager';
import { pineconeService } from '../../services/pineconeService';
import { aiParser } from '../../services/aiParser';

jest.mock('../../services/pineconeService');
jest.mock('../../services/aiParser');

describe('StrategyManager', () => {
  let strategyManager: StrategyManager;

  beforeEach(() => {
    strategyManager = new StrategyManager();
    jest.clearAllMocks();
  });

  describe('approveStrategy', () => {
    it('should reject strategy without stop loss', async () => {
      const strategy = {
        strategy_id: 'test-123',
        stop_loss_percent: 0
      };

      await expect(
        strategyManager.approveStrategy('test-123', {
          stop_loss_percent: 0,
          take_profit_percent: 5,
        })
      ).rejects.toThrow('Stop loss is required');
    });

    it('should approve strategy with valid parameters', async () => {
      const mockStrategy = {
        strategy_id: 'test-123',
        strategy_name: 'Test Strategy',
        status: 'pending'
      };

      (pineconeService.saveStrategy as jest.Mock).mockResolvedValue(undefined);

      const approved = await strategyManager.approveStrategy('test-123', {
        stop_loss_percent: 2,
        take_profit_percent: 5,
        position_size: 100
      });

      expect(approved.status).toBe('active');
      expect(approved.stop_loss_percent).toBe(2);
      expect(approved.approved_at).toBeDefined();
    });
  });
}); 