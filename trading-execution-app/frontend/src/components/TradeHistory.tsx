import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { formatCurrency, formatDate } from '../lib/utils';

interface TradeHistoryItem {
  id: string;
  strategy_name: string;
  asset: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  value: number;
  timestamp: string;
  type: 'entry' | 'exit' | 'stop_loss' | 'take_profit';
  pnl?: number;
  success: boolean;
}

export function TradeHistory() {
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  const { data: trades, isLoading } = useQuery({
    queryKey: ['trade-history', filter, dateRange],
    queryFn: () => api.get('/trading/history', {
      params: { filter, dateRange },
    }) as Promise<TradeHistoryItem[]>,
  });

  const exportToCSV = () => {
    if (!trades) return;

    const headers = [
      'Date',
      'Strategy',
      'Asset',
      'Side',
      'Type',
      'Price',
      'Quantity',
      'Value',
      'P&L',
      'Success',
    ].join(',');

    const rows = trades.map((trade: TradeHistoryItem) =>
      [
        formatDate(trade.timestamp),
        trade.strategy_name,
        trade.asset,
        trade.side,
        trade.type,
        trade.price,
        trade.quantity,
        trade.value,
        trade.pnl || '',
        trade.success,
      ].join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return <div>Loading trade history...</div>;
  }

  const calculateStats = () => {
    if (!trades || trades.length === 0) return null;

    const exitTrades = trades.filter((t: TradeHistoryItem) => 
      t.type === 'exit' || t.type === 'stop_loss' || t.type === 'take_profit'
    );

    const winningTrades = exitTrades.filter((t: TradeHistoryItem) => t.pnl && t.pnl > 0);
    const losingTrades = exitTrades.filter((t: TradeHistoryItem) => t.pnl && t.pnl < 0);
    const totalPnl = exitTrades.reduce((sum: number, t: TradeHistoryItem) => 
      sum + (t.pnl || 0), 0
    );

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: exitTrades.length > 0 
        ? (winningTrades.length / exitTrades.length * 100).toFixed(1)
        : '0',
      totalPnl,
    };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Winning Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.winningTrades}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Losing Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.losingTrades}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.winRate}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(stats.totalPnl)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trade History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trade History</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  <SelectItem value="entry">Entries Only</SelectItem>
                  <SelectItem value="exit">Exits Only</SelectItem>
                  <SelectItem value="winning">Winning</SelectItem>
                  <SelectItem value="losing">Losing</SelectItem>
                </SelectContent>
              </Select>
              
              <Button size="sm" variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>P&L</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades?.map((trade: TradeHistoryItem) => (
                <TableRow key={trade.id}>
                  <TableCell className="text-sm">
                    {formatDate(trade.timestamp)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {trade.strategy_name}
                  </TableCell>
                  <TableCell>{trade.asset}</TableCell>
                  <TableCell>
                    <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {trade.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(trade.price)}</TableCell>
                  <TableCell>{trade.quantity.toFixed(8)}</TableCell>
                  <TableCell>{formatCurrency(trade.value)}</TableCell>
                  <TableCell className={
                    trade.pnl 
                      ? trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      : ''
                  }>
                    {trade.pnl ? formatCurrency(trade.pnl) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={trade.success ? 'default' : 'destructive'}>
                      {trade.success ? 'Success' : 'Failed'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 