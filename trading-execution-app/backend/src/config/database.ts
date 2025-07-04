// Database configuration
// This file can be expanded later to include database connections

import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

export class DatabaseService {
  private db: Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor() {
    // Store database in data directory
    const dataDir = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.dbPath = path.join(dataDir, 'trading.db');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info(`🗄️  Initializing SQLite database at: ${this.dbPath}`);
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('❌ Failed to open database:', err);
          throw err;
        }
        logger.info('✅ SQLite database connected successfully');
      });

      // Create tables
      await this.createTables();
      this.isInitialized = true;
      
      logger.info('🗄️  Database initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const tables = [
      // Trade History Table
      `CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
        entry_price REAL NOT NULL,
        exit_price REAL,
        quantity REAL NOT NULL,
        entry_time DATETIME NOT NULL,
        exit_time DATETIME,
        pnl REAL,
        status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'failed')),
        order_id TEXT,
        fees REAL DEFAULT 0,
        slippage REAL DEFAULT 0,
        metadata TEXT, -- JSON string for additional data
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Compliance Logs Table
      `CREATE TABLE IF NOT EXISTS compliance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        strategy_id TEXT,
        symbol TEXT,
        action TEXT,
        details TEXT NOT NULL, -- JSON string
        risk_assessment TEXT, -- JSON string
        approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        user_id TEXT DEFAULT 'system'
      )`,
      
      // Market Data History Table
      `CREATE TABLE IF NOT EXISTS market_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        price REAL NOT NULL,
        bid REAL,
        ask REAL,
        volume REAL DEFAULT 0,
        sequence_number INTEGER,
        source TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Strategy Performance Table
      `CREATE TABLE IF NOT EXISTS strategy_performance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        date DATE NOT NULL,
        total_trades INTEGER DEFAULT 0,
        winning_trades INTEGER DEFAULT 0,
        losing_trades INTEGER DEFAULT 0,
        total_pnl REAL DEFAULT 0,
        max_drawdown REAL DEFAULT 0,
        sharpe_ratio REAL DEFAULT 0,
        win_rate REAL DEFAULT 0,
        avg_trade_duration REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(strategy_id, date)
      )`,
      
      // System Events Table
      `CREATE TABLE IF NOT EXISTS system_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
        message TEXT NOT NULL,
        details TEXT, -- JSON string
        source TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_trades_strategy_id ON trades(strategy_id)',
      'CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time)',
      'CREATE INDEX IF NOT EXISTS idx_compliance_logs_event_type ON compliance_logs(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_compliance_logs_timestamp ON compliance_logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_id ON strategy_performance(strategy_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(timestamp)'
    ];

    // Create tables
    for (const tableSQL of tables) {
      await this.run(tableSQL);
    }

    // Create indexes
    for (const indexSQL of indexes) {
      await this.run(indexSQL);
    }

    logger.info('📊 Database tables and indexes created successfully');
  }

  // Promise wrapper for database operations
  async run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async insert(sql: string, params: any[] = []): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          logger.info('🗄️  Database connection closed');
          resolve();
        }
      });
    });
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('SELECT 1 as test');
      return true;
    } catch (error) {
      logger.error('❌ Database health check failed:', error);
      return false;
    }
  }

  // Get database statistics
  async getStats(): Promise<any> {
    try {
      const stats = await Promise.all([
        this.get("SELECT COUNT(*) as count FROM trades"),
        this.get("SELECT COUNT(*) as count FROM compliance_logs"),
        this.get("SELECT COUNT(*) as count FROM market_data"),
        this.get("SELECT COUNT(*) as count FROM strategy_performance"),
        this.get("SELECT COUNT(*) as count FROM system_events")
      ]);

      return {
        trades: stats[0]?.count || 0,
        compliance_logs: stats[1]?.count || 0,
        market_data: stats[2]?.count || 0,
        strategy_performance: stats[3]?.count || 0,
        system_events: stats[4]?.count || 0
      };
    } catch (error) {
      logger.error('❌ Failed to get database stats:', error);
      return null;
    }
  }
}

export const databaseService = new DatabaseService(); 