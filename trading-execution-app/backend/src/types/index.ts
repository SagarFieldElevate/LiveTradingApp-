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
  timeframe?: '1h' | '4h' | '1d';
  
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
    indicator?: string;
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
  current_price: number;
  quantity: number;
  trailing_stop_price: number;
  take_profit_price: number;
  status: 'open' | 'closed';
  entry_time: Date;
  exit_time?: Date;
  exit_price?: number;
  pnl?: number;
  coinbase_order_id?: string;
}

export interface TradeSignal {
  strategy_id: string;
  action: 'enter' | 'exit';
  asset: string;
  side: 'buy' | 'sell';
  reason: string;
  confidence: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  change_24h?: number;
  high_24h?: number;
  low_24h?: number;
}

export interface OrderRequest {
  strategy_id: string;
  asset: string;
  side: 'buy' | 'sell';
  amount_usd: number;
  order_type: 'market' | 'limit';
  limit_price?: number;
}

export interface OrderResponse {
  order_id: string;
  status: 'pending' | 'filled' | 'rejected';
  filled_price?: number;
  filled_quantity?: number;
  timestamp: Date;
  error?: string;
}

export interface NotificationMessage {
  type: 'trade' | 'error' | 'alert';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
} 