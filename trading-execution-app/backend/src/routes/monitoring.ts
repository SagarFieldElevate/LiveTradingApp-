import express from 'express';
import { conditionMonitor } from '../services/conditionMonitor';
import { marketDataStream } from '../services/marketDataStream';
import { technicalIndicators } from '../services/technicalIndicators';
import { polygonService } from '../services/polygonService';
import { logger } from '../utils/logger';

const router = express.Router();

// Start monitoring
router.post('/start', async (req, res) => {
  try {
    await conditionMonitor.startMonitoring();
    res.json({ message: 'Monitoring started' });
  } catch (error) {
    logger.error('Failed to start monitoring:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
});

// Stop monitoring
router.post('/stop', async (req, res) => {
  try {
    conditionMonitor.stopMonitoring();
    res.json({ message: 'Monitoring stopped' });
  } catch (error) {
    logger.error('Failed to stop monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

// Get monitoring status
router.get('/status', async (req, res) => {
  const isMonitoring = conditionMonitor.getMonitoringStatus();
  
  res.json({
    market_data: {
      connected: marketDataStream.getConnectionStatus(),
      subscribed_symbols: marketDataStream.getSubscribedSymbols()
    },
    monitoring: {
      active: isMonitoring,
      check_count: 0,
      last_check_time: new Date().toISOString()
    },
    polygon_api: {
      available: polygonService.isAvailable()
    }
  });
});

// Get current market prices
router.get('/prices', async (req, res) => {
  const { symbols } = req.query;
  const symbolList = (symbols as string)?.split(',') || [];
  
  const prices: any = {};
  
  // Define which assets come from which API
  const cryptoAssets = ['BTC', 'ETH', 'DOGE', 'ADA', 'LINK'];
  const polygonAssets = ['WTI_CRUDE_OIL', 'GOLD', 'SPY', 'QQQ'];
  const defiAssets = ['DEFILLAMA_DEX_VOLUME'];
  
  for (const symbol of symbolList) {
    try {
      if (cryptoAssets.includes(symbol) || symbol.includes('-USD')) {
        // Use Coinbase for crypto
        const price = technicalIndicators.getCurrentPrice(symbol);
        const quote = marketDataStream.getLatestQuote(symbol);
        prices[symbol] = {
          price,
          bid: quote?.bid,
          ask: quote?.ask,
          spread: quote ? ((quote.ask - quote.bid) / quote.price) * 100 : null,
          fresh: technicalIndicators.isDataFresh(symbol),
          source: 'coinbase'
        };
      } else if (polygonAssets.includes(symbol)) {
        // Use Polygon for traditional assets
        const quote = await polygonService.fetchQuote(symbol);
        prices[symbol] = {
          price: quote?.price || null,
          bid: null,
          ask: null,
          spread: null,
          fresh: quote !== null,
          source: 'polygon',
          timestamp: quote?.timestamp
        };
      } else if (defiAssets.includes(symbol)) {
        // Special handling for DeFi data
        const value = await polygonService.fetchDeFiData(symbol);
        prices[symbol] = {
          price: value,
          bid: null,
          ask: null,
          spread: null,
          fresh: value !== null,
          source: 'defi',
          timestamp: new Date()
        };
      } else {
        // Try both APIs for unknown symbols
        let price = technicalIndicators.getCurrentPrice(symbol);
        let source = 'coinbase';
        
        if (!price) {
          const quote = await polygonService.fetchQuote(symbol);
          price = quote?.price || null;
          source = 'polygon';
        }
        
        prices[symbol] = {
          price,
          bid: null,
          ask: null,
          spread: null,
          fresh: price !== null,
          source: source
        };
      }
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      prices[symbol] = {
        price: null,
        error: 'Failed to fetch',
        source: 'error'
      };
    }
  }
  
  logger.info(`Fetched prices for ${symbolList.length} symbols: ${JSON.stringify(Object.keys(prices))}`);
  res.json({ prices });
});

// Subscribe to market data for specific symbols
router.post('/subscribe', async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Invalid symbols array' });
    }

    await marketDataStream.subscribeToAssets(symbols);
    res.json({ 
      message: 'Subscribed successfully', 
      symbols 
    });
  } catch (error: any) {
    logger.error('Failed to subscribe to symbols:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe from market data for a symbol
router.post('/unsubscribe/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    await marketDataStream.unsubscribeFromSymbol(symbol);
    res.json({ 
      message: 'Unsubscribed successfully', 
      symbol 
    });
  } catch (error: any) {
    logger.error('Failed to unsubscribe from symbol:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 