const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    message: 'Test server is running!'
  });
});

app.get('/api/strategies', (req, res) => {
  res.json([
    {
      strategy_id: 'test-1',
      strategy_name: 'Test Strategy',
      status: 'pending',
      description: 'This is a test strategy'
    }
  ]);
});

app.get('/api/trading/portfolio', (req, res) => {
  res.json({
    total_value: 10000,
    cash_balance: 5000,
    positions_value: 5000,
    open_positions: 2,
    daily_pnl: 150,
    positions: [
      {
        position_id: 'test-pos-1',
        symbol: 'BTC-USD',
        quantity: 0.1,
        entry_price: 45000,
        current_price: 46500,
        unrealized_pnl: 150,
        entry_time: new Date()
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
}); 