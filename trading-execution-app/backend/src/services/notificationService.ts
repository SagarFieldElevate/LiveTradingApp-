import { WebClient } from '@slack/web-api';
import { logger } from '../utils/logger';
import { NotificationMessage } from '../types';

interface TradeAlert {
  type: 'entry' | 'exit';
  strategy_name: string;
  asset: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  pnl?: number;
  reason: string;
}

export class NotificationService {
  private slack: WebClient;
  private tradeChannel: string;
  private errorChannel: string;

  constructor() {
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.tradeChannel = process.env.SLACK_CHANNEL_TRADES || '#trading-alerts';
    this.errorChannel = process.env.SLACK_CHANNEL_ERRORS || '#trading-errors';
  }

  async sendTradeAlert(trade: TradeAlert) {
    try {
      const color = trade.type === 'entry' ? '#36a64f' : 
                   (trade.pnl && trade.pnl > 0) ? '#36a64f' : '#ff0000';
      
      const fields = [
        {
          title: 'Strategy',
          value: trade.strategy_name,
          short: true
        },
        {
          title: 'Asset',
          value: trade.asset,
          short: true
        },
        {
          title: 'Side',
          value: trade.side.toUpperCase(),
          short: true
        },
        {
          title: 'Price',
          value: `$${trade.price.toFixed(2)}`,
          short: true
        },
        {
          title: 'Quantity',
          value: trade.quantity.toFixed(8),
          short: true
        },
        {
          title: 'Reason',
          value: trade.reason,
          short: true
        }
      ];

      if (trade.pnl !== undefined) {
        fields.push({
          title: 'P&L',
          value: `$${trade.pnl.toFixed(2)} (${trade.pnl > 0 ? '+' : ''}${((trade.pnl / (trade.price * trade.quantity)) * 100).toFixed(2)}%)`,
          short: false
        });
      }

      await this.slack.chat.postMessage({
        channel: this.tradeChannel,
        attachments: [{
          color: color,
          title: `🔔 Trade ${trade.type === 'entry' ? 'Opened' : 'Closed'}`,
          fields: fields,
          footer: 'Trading Execution System',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      });

      logger.info(`Trade alert sent: ${trade.type} ${trade.asset}`);
    } catch (error) {
      logger.error('Failed to send trade alert:', error);
    }
  }

  async sendErrorAlert(error: Error, context: any) {
    try {
      await this.slack.chat.postMessage({
        channel: this.errorChannel,
        attachments: [{
          color: '#ff0000',
          title: '⚠️ Trading Error',
          fields: [
            {
              title: 'Error Message',
              value: error.message,
              short: false
            },
            {
              title: 'Stack Trace',
              value: `\`\`\`${error.stack?.substring(0, 500)}\`\`\``,
              short: false
            },
            {
              title: 'Context',
              value: `\`\`\`${JSON.stringify(context, null, 2).substring(0, 500)}\`\`\``,
              short: false
            }
          ],
          footer: 'Trading Execution System',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      });

      logger.info('Error alert sent');
    } catch (slackError) {
      logger.error('Failed to send error alert:', slackError);
    }
  }

  async sendCriticalAlert(message: string, details: any) {
    try {
      // Send to both channels for critical issues
      const criticalMessage = {
        channel: this.errorChannel,
        text: `<!channel> 🚨 CRITICAL ALERT 🚨`,
        attachments: [{
          color: '#ff0000',
          title: message,
          fields: [
            {
              title: 'Details',
              value: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
              short: false
            },
            {
              title: 'Action Required',
              value: 'Immediate manual intervention required',
              short: false
            }
          ],
          footer: 'Trading Execution System - CRITICAL',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      };

      await this.slack.chat.postMessage(criticalMessage);
      
      // Also send to trades channel
      criticalMessage.channel = this.tradeChannel;
      await this.slack.chat.postMessage(criticalMessage);

      logger.error(`CRITICAL alert sent: ${message}`);
    } catch (error) {
      logger.error('Failed to send critical alert:', error);
    }
  }

  async sendEmergencyAlert(message: string, details: any) {
    try {
      await this.slack.chat.postMessage({
        channel: this.errorChannel,
        text: `<!channel> 🆘 EMERGENCY 🆘`,
        attachments: [{
          color: '#ff0000',
          title: `EMERGENCY: ${message}`,
          fields: [
            {
              title: 'Details',
              value: `\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
              short: false
            },
            {
              title: 'System Status',
              value: 'ALL TRADING HALTED - Manual restart required',
              short: false
            }
          ],
          footer: 'Trading Execution System - EMERGENCY',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to send emergency alert:', error);
    }
  }

  async sendDailySummary(portfolio: any, trades: any[]) {
    try {
      const summary = {
        total_trades: trades.length,
        winning_trades: trades.filter(t => t.pnl > 0).length,
        losing_trades: trades.filter(t => t.pnl < 0).length,
        total_pnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        win_rate: trades.length > 0 ? 
          (trades.filter(t => t.pnl > 0).length / trades.length * 100).toFixed(2) : 0
      };

      await this.slack.chat.postMessage({
        channel: this.tradeChannel,
        attachments: [{
          color: summary.total_pnl >= 0 ? '#36a64f' : '#ff0000',
          title: '📊 Daily Trading Summary',
          fields: [
            {
              title: 'Portfolio Value',
              value: `$${portfolio.total_value.toFixed(2)}`,
              short: true
            },
            {
              title: 'Daily P&L',
              value: `$${portfolio.daily_pnl.toFixed(2)} (${(portfolio.daily_pnl / portfolio.total_value * 100).toFixed(2)}%)`,
              short: true
            },
            {
              title: 'Total Trades',
              value: summary.total_trades.toString(),
              short: true
            },
            {
              title: 'Win Rate',
              value: `${summary.win_rate}%`,
              short: true
            },
            {
              title: 'Winning Trades',
              value: summary.winning_trades.toString(),
              short: true
            },
            {
              title: 'Losing Trades',
              value: summary.losing_trades.toString(),
              short: true
            }
          ],
          footer: 'Trading Execution System - Daily Summary',
          ts: Math.floor(Date.now() / 1000).toString()
        }]
      });
    } catch (error) {
      logger.error('Failed to send daily summary:', error);
    }
  }

  async sendNotification(message: NotificationMessage) {
    switch (message.type) {
      case 'trade':
        await this.sendTradeAlert({
          type: message.metadata?.pnl !== undefined ? 'exit' : 'entry',
          strategy_name: message.metadata?.strategy || 'N/A',
          asset: message.metadata?.asset || 'N/A',
          side: message.metadata?.side || 'buy',
          price: message.metadata?.price || 0,
          quantity: message.metadata?.quantity || 0,
          pnl: message.metadata?.pnl,
          reason: message.message
        });
        break;
      case 'error':
        await this.sendErrorAlert(new Error(message.message), message.metadata);
        break;
      case 'alert':
      default:
        await this.sendCriticalAlert(message.title, message.metadata);
        break;
    }
  }
}

export const notificationService = new NotificationService(); 