export interface Strategy {
  id: string;
  user_id: string;
  strategy_id: string;
  strategy_name: string;
  description: string;
  asset_1: string;
  asset_2: string;
  favorited_at: string;
  quality_score: number;
  sharpe_ratio: number;
  total_trades: number;
  type: string;
  status: 'pending' | 'active' | 'paused' | 'archived';
}

export interface ParsedStrategy extends Strategy {
  entry_conditions: EntryCondition;
  exit_conditions: ExitCondition;
  required_assets: string[];
  position_size: number;
  approved_at?: string;
  stop_loss_percent?: number;
  take_profit_percent?: number;
}

export interface EntryCondition {
  type: 'percentage_move' | 'correlation' | 'single_correlation' | 'multi_asset_correlation' | 'technical_indicator';
  
  // For single asset strategies
  primary_asset?: string;
  secondary_asset?: string;
  threshold?: number;
  direction?: 'up' | 'down' | 'any';
  timeframe?: string;
  
  // For multi-asset correlation strategies
  triggers?: Array<{
    asset: string;
    direction: 'up' | 'down';
    threshold_percent?: number | null;
  }>;
  target_asset?: string;
  action?: 'buy' | 'sell';
  delay_days?: number;
  
  additional_params?: {
    correlation_threshold?: number;
    atr_multiplier?: number;
  };
}

export interface ExitCondition {
  stop_loss: {
    type: 'percentage' | 'atr' | 'fixed';
    value: number;
    is_trailing: boolean;
  };
  take_profit: {
    type: 'percentage' | 'atr' | 'fixed';
    value: number;
  };
  max_hold_period?: {
    value: number;
    unit: 'hours' | 'days';
  };
  max_hold_days?: number; // Alternative format for days only
}

export interface Position {
  id: string;
  strategy_id: string;
  asset: string;
  side: 'buy' | 'sell';
  entry_price: number;
  current_price?: number;
  quantity: number;
  status: 'open' | 'closed';
  entry_time: string;
  exit_time?: string;
  exit_price?: number;
  pnl?: number;
  stop_loss_price?: number;
  take_profit_price?: number;
  trailing_stop_price?: number;
  unrealized_pnl?: number;
}

export interface TradingUpdate {
  type: 'trade' | 'position' | 'strategy' | 'error';
  data: any;
  timestamp: string;
}

export interface Portfolio {
  total_value: number;
  cash_balance: number;
  positions_value: number;
  daily_pnl: number;
  open_positions: Position[];
}

export interface TradeSignal {
  strategy_id: string;
  action: 'enter' | 'exit';
  asset: string;
  side: 'buy' | 'sell';
  reason: string;
  confidence: number;
}

export interface OrderRequest {
  product_id: string;
  side: 'BUY' | 'SELL';
  order_type: 'MARKET' | 'LIMIT';
  size?: string;
  quote_size?: string;
  limit_price?: string;
}

export interface OrderResponse {
  order_id: string;
  product_id: string;
  side: string;
  order_type: string;
  size: string;
  filled_size: string;
  status: string;
  created_time: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: string;
} 