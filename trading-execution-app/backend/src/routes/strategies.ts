import express from 'express';
import { strategyManager } from '../services/strategyManager';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const ApproveStrategySchema = z.object({
  stop_loss_percent: z.number().min(0.1).max(50),
  take_profit_percent: z.number().min(0.1).max(100),
  position_size: z.number().min(1).optional()
});

// Get all strategies
router.get('/', async (req, res) => {
  try {
    const strategies = strategyManager.getAllStrategies();
    res.json({ strategies });
  } catch (error) {
    logger.error('Failed to get strategies:', error);
    res.status(500).json({ error: 'Failed to retrieve strategies' });
  }
});

// Get active strategies
router.get('/active', async (req, res) => {
  try {
    const strategies = strategyManager.getActiveStrategies();
    res.json({ strategies });
  } catch (error) {
    logger.error('Failed to get active strategies:', error);
    res.status(500).json({ error: 'Failed to retrieve active strategies' });
  }
});

// Sync strategies from Pinecone
router.post('/sync', async (req, res) => {
  try {
    await strategyManager.loadStrategies();
    res.json({ message: 'Strategies synced successfully' });
  } catch (error) {
    logger.error('Failed to sync strategies:', error);
    res.status(500).json({ error: 'Failed to sync strategies' });
  }
});

// Approve strategy
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = ApproveStrategySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error 
      });
    }

    const approved = await strategyManager.approveStrategy(id, validation.data);
    res.json({ strategy: approved });
  } catch (error: any) {
    logger.error('Failed to approve strategy:', error);
    res.status(400).json({ error: error.message });
  }
});

// Edit strategy parameters
router.put('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = ApproveStrategySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: validation.error 
      });
    }

    const updated = await strategyManager.editStrategy(id, validation.data);
    res.json({ strategy: updated });
  } catch (error: any) {
    logger.error('Failed to edit strategy:', error);
    res.status(400).json({ error: error.message });
  }
});

// Pause strategy
router.put('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    await strategyManager.pauseStrategy(id);
    res.json({ message: 'Strategy paused' });
  } catch (error: any) {
    logger.error('Failed to pause strategy:', error);
    res.status(400).json({ error: error.message });
  }
});

// Resume strategy
router.put('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    await strategyManager.resumeStrategy(id);
    res.json({ message: 'Strategy resumed' });
  } catch (error: any) {
    logger.error('Failed to resume strategy:', error);
    res.status(400).json({ error: error.message });
  }
});

// Re-parse strategy
router.post('/:id/reparse', async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    
    const reparsed = await strategyManager.reparseStrategy(id, comments || '');
    res.json({ strategy: reparsed });
  } catch (error: any) {
    logger.error('Failed to reparse strategy:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router; 