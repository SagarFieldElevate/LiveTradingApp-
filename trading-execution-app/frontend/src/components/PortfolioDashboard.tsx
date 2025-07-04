import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { api } from '../lib/api';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { formatCurrency, formatPercent } from '../lib/utils';

export function PortfolioDashboard() {
  const { socket, portfolio, setPortfolio, positions, setPositions } = useStore();

  const { data, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.get('/trading/portfolio') as Promise<any>,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  useEffect(() => {
    if (data) {
      setPortfolio(data);
      setPositions(data.open_positions || []);
    }
  }, [data, setPortfolio, setPositions]);

  useEffect(() => {
    if (!socket) return;

    socket.on('portfolio:update', (updatedPortfolio: any) => {
      setPortfolio(updatedPortfolio);
    });

    socket.on('position:update', ({ position, unrealized_pnl }: any) => {
      setPositions(
        positions.map((p) =>
          p.id === position.id
            ? { ...position, unrealized_pnl }
            : p
        )
      );
    });

    return () => {
      socket.off('portfolio:update');
      socket.off('position:update');
    };
  }, [socket, setPortfolio, setPositions]);

  if (isLoading || !portfolio) {
    return <div>Loading portfolio...</div>;
  }

  const closePosition = async (positionId: string) => {
    try {
      await api.post(`/trading/positions/${positionId}/close`, {
        reason: 'Manual close',
      });
    } catch (error) {
      console.error('Failed to close position:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Type Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Trading Portfolio
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Showing your active trading portfolio (~$10k) - API-enabled for live trading
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Total Value</h3>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(portfolio.total_value)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Daily P&L</h3>
            {portfolio.daily_pnl >= 0 ? (
              <ArrowUpIcon className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDownIcon className="h-4 w-4 text-red-600" />
            )}
          </div>
          <div className={`text-2xl font-bold ${
            portfolio.daily_pnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(portfolio.daily_pnl)}
            <span className="text-sm font-normal ml-1">
              ({formatPercent(portfolio.daily_pnl / portfolio.total_value)})
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Open Positions</h3>
          </div>
          <div className="text-2xl font-bold">
            {portfolio.open_positions.length}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium">Cash Balance</h3>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(portfolio.cash_balance)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Available for trading
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h3 className="text-lg font-bold mb-4">Open Positions</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Asset</th>
                  <th className="text-left py-2">Strategy</th>
                  <th className="text-left py-2">Entry Price</th>
                  <th className="text-left py-2">Current Price</th>
                  <th className="text-left py-2">Quantity</th>
                  <th className="text-left py-2">P&L</th>
                  <th className="text-left py-2">Stop Loss</th>
                  <th className="text-left py-2">Take Profit</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const currentPrice = position.current_price || position.entry_price;
                  const pnl = (currentPrice - position.entry_price) * position.quantity;
                  const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100;
                  
                  return (
                    <tr key={position.id} className="border-b">
                      <td className="py-2 font-medium">{position.asset}</td>
                      <td className="py-2">{position.strategy_id}</td>
                      <td className="py-2">{formatCurrency(position.entry_price)}</td>
                      <td className="py-2">{formatCurrency(currentPrice)}</td>
                      <td className="py-2">{position.quantity.toFixed(8)}</td>
                      <td className={`py-2 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(pnl)} ({formatPercent(pnlPercent / 100)})
                      </td>
                      <td className="py-2">
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {formatCurrency(position.trailing_stop_price || position.stop_loss_price || 0)}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {formatCurrency(position.take_profit_price || 0)}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => closePosition(position.id)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 