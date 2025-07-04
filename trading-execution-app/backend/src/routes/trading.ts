import express from 'express';
import { tradeExecutor } from '../services/tradeExecutor';
import { portfolioMonitor } from '../services/portfolioMonitor';
import { logger } from '../utils/logger';

const router = express.Router();

// Get portfolio
router.get('/portfolio', async (req, res) => {
  try {
    const portfolio = await portfolioMonitor.getPortfolio();
    res.json(portfolio);
  } catch (error) {
    logger.error('Failed to get portfolio:', error);
    res.status(500).json({ error: 'Failed to retrieve portfolio' });
  }
});

// Get open positions
router.get('/positions', async (req, res) => {
  try {
    const positions = portfolioMonitor.getOpenPositions();
    res.json({ positions });
  } catch (error) {
    logger.error('Failed to get positions:', error);
    res.status(500).json({ error: 'Failed to retrieve positions' });
  }
});

// Manual position close
router.post('/positions/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Manual close' } = req.body;
    
    const positions = portfolioMonitor.getOpenPositions();
    const position = positions.find(p => p.id === id);
    
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    await tradeExecutor.closePosition(position, reason);
    res.json({ message: 'Position close initiated' });
  } catch (error: any) {
    logger.error('Failed to close position:', error);
    res.status(500).json({ error: error.message });
  }
});

// Emergency close all positions (KILL SWITCH)
router.post('/emergency/close-all', async (req, res) => {
  try {
    const { reason = 'Emergency close', auth_code } = req.body;
    
    // Simple auth check for emergency actions
    if (auth_code !== process.env.EMERGENCY_AUTH_CODE) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await tradeExecutor.emergencyCloseAll(reason);
    res.json({ message: 'Emergency close initiated' });
  } catch (error: any) {
    logger.error('Emergency close failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync with Coinbase
router.post('/sync', async (req, res) => {
  try {
    await portfolioMonitor.syncWithCoinbase();
    res.json({ message: 'Sync completed' });
  } catch (error) {
    logger.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

export default router; 