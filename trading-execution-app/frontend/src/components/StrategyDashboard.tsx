import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStore } from '../store';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw, Play, Pause, Eye, Edit, Activity, Circle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatPercent, formatCurrency } from '../lib/utils';

interface EditModalProps {
  strategy: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: any) => void;
}

function EditStrategyModal({ strategy, isOpen, onClose, onSave }: EditModalProps) {
  const [stopLoss, setStopLoss] = useState(strategy?.stop_loss_percent?.toString() || '');
  const [takeProfit, setTakeProfit] = useState(strategy?.take_profit_percent?.toString() || '');
  const [positionSize, setPositionSize] = useState(strategy?.position_size?.toString() || '100');

  useEffect(() => {
    if (strategy) {
      setStopLoss(strategy.stop_loss_percent?.toString() || '');
      setTakeProfit(strategy.take_profit_percent?.toString() || '');
      setPositionSize(strategy.position_size?.toString() || '100');
    }
  }, [strategy]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      stop_loss_percent: parseFloat(stopLoss),
      take_profit_percent: parseFloat(takeProfit),
      position_size: parseFloat(positionSize),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-bold mb-4">Edit Strategy Parameters</h3>
        <p className="text-sm text-gray-600 mb-4">{strategy?.strategy_name}</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Stop Loss %</label>
            <input
              type="number"
              step="0.1"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="2.0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Take Profit %</label>
            <input
              type="number"
              step="0.1"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="5.0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Position Size ($)</label>
            <input
              type="number"
              step="1"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="100"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}

export function StrategyDashboard() {
  const { 
    socket, 
    strategies, 
    setStrategies, 
    setPendingStrategy,
    setShowApprovalModal 
  } = useStore();

  const [editingStrategy, setEditingStrategy] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, { price?: number; bid?: number; ask?: number }>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api.get('/strategies') as Promise<any>,
  });

  // Fetch market prices for monitoring status
  const { data: pricesData } = useQuery({
    queryKey: ['market-prices'],
    queryFn: () => api.get('/monitoring/prices?symbols=BTC,ETH,DOGE,ADA,LINK,WTI_CRUDE_OIL,SPY,QQQ') as Promise<any>,
    refetchInterval: 5000, // Update every 5 seconds
  });

  useEffect(() => {
    if (pricesData?.prices) {
      setMarketPrices(pricesData.prices);
    }
  }, [pricesData]);

  const syncMutation = useMutation({
    mutationFn: () => api.post('/strategies/sync'),
    onSuccess: () => {
      alert('Sync started - checking for new favorited strategies...');
      refetch();
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.put(`/strategies/${id}/pause`),
    onSuccess: () => {
      alert('Strategy paused');
      refetch();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.put(`/strategies/${id}/resume`),
    onSuccess: () => {
      alert('Strategy resumed');
      refetch();
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      api.put(`/strategies/${id}/edit`, updates),
    onSuccess: () => {
      alert('Strategy updated successfully');
      refetch();
    },
  });

  useEffect(() => {
    if (data?.strategies) {
      setStrategies(data.strategies);
    }
  }, [data, setStrategies]);

  useEffect(() => {
    if (!socket) return;

    socket.on('strategy:new', (strategy: any) => {
      setPendingStrategy(strategy);
      setShowApprovalModal(true);
    });

    socket.on('strategy:approved', (strategy: any) => {
      setStrategies(
        strategies.map((s) => s.strategy_id === strategy.strategy_id ? strategy : s)
      );
    });

    socket.on('strategy:updated', (strategy: any) => {
      setStrategies(
        strategies.map((s) => s.strategy_id === strategy.strategy_id ? strategy : s)
      );
    });

    socket.on('strategy:paused', (strategyId: string) => {
      setStrategies(
        strategies.map((s) => 
          s.strategy_id === strategyId ? { ...s, status: 'paused' as const } : s
        )
      );
    });

    socket.on('strategy:resumed', (strategyId: string) => {
      setStrategies(
        strategies.map((s) => 
          s.strategy_id === strategyId ? { ...s, status: 'active' as const } : s
        )
      );
    });

    return () => {
      socket.off('strategy:new');
      socket.off('strategy:approved');
      socket.off('strategy:updated');
      socket.off('strategy:paused');
      socket.off('strategy:resumed');
    };
  }, [socket, strategies, setStrategies, setPendingStrategy, setShowApprovalModal]);

  if (isLoading) {
    return <div>Loading strategies...</div>;
  }

  const pendingStrategies = strategies.filter(s => s.status === 'pending');
  const activeStrategies = strategies.filter(s => s.status === 'active');
  const pausedStrategies = strategies.filter(s => s.status === 'paused');

  const handleEdit = (strategy: any) => {
    setEditingStrategy(strategy);
    setShowEditModal(true);
  };

  const handleSaveEdit = (updates: any) => {
    if (editingStrategy) {
      editMutation.mutate({ id: editingStrategy.strategy_id, updates });
    }
  };

  const getMonitoringStatus = (strategy: any) => {
    if (strategy.status !== 'active') return null;
    
    const assets = strategy.required_assets || [];
    const monitoredAssets = assets.filter((asset: string) => asset !== 'BTC-USD'); // Exclude target asset
    const pricesAvailable = monitoredAssets.filter((asset: string) => marketPrices[asset]?.price);
    
    return {
      total: monitoredAssets.length,
      monitored: pricesAvailable.length,
      assets: monitoredAssets,
    };
  };

  return (
    <div className="space-y-6">
      {/* Strategy Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{strategies.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeStrategies.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pendingStrategies.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {pausedStrategies.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync from Pinecone
        </Button>
      </div>

      {/* Pending Strategies */}
      {pendingStrategies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingStrategies.map((strategy) => (
                <div
                  key={strategy.strategy_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{strategy.strategy_name}</p>
                    <p className="text-sm text-gray-600">
                      {typeof strategy.description === 'string'
                        ? strategy.description.substring(0, 100)
                        : String(strategy.description).substring(0, 100)}...
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPendingStrategy(strategy);
                      setShowApprovalModal(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Strategies */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Monitoring Status</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Sharpe Ratio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stop Loss</TableHead>
                <TableHead>Take Profit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies.map((strategy) => {
                const monitoringStatus = getMonitoringStatus(strategy);
                
                return (
                  <TableRow key={strategy.strategy_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{strategy.strategy_name}</p>
                        <p className="text-xs text-gray-600">
                          {strategy.total_trades} trades
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {strategy.status === 'active' && monitoringStatus ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Circle className={`w-2 h-2 ${monitoringStatus.monitored === monitoringStatus.total ? 'fill-green-500 text-green-500' : 'fill-yellow-500 text-yellow-500'}`} />
                            <span className="text-xs font-medium">
                              {monitoringStatus.monitored}/{monitoringStatus.total} assets tracked
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {monitoringStatus.assets.map((asset: string) => {
                              const priceData = marketPrices[asset];
                              const price = priceData?.price;
                              return (
                                <div key={asset} className="flex justify-between">
                                  <span>{asset}:</span>
                                  <span className={price ? 'text-green-600' : 'text-red-500'}>
                                    {price ? formatCurrency(price) : 'No data'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : strategy.status === 'active' ? (
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-green-500" />
                          <span className="text-xs">Monitoring</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not monitoring</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {strategy.required_assets.map((asset: string) => (
                          <Badge key={asset} variant="outline" className="text-xs">
                            {asset}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{strategy.sharpe_ratio.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          strategy.status === 'active'
                            ? 'default'
                            : strategy.status === 'paused'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {strategy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {strategy.stop_loss_percent
                        ? formatPercent(strategy.stop_loss_percent / 100)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {strategy.take_profit_percent
                        ? formatPercent(strategy.take_profit_percent / 100)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Edit button for all strategies */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(strategy)}
                          title="Edit strategy parameters"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        
                        {/* Pause/Resume button */}
                        {strategy.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => pauseMutation.mutate(strategy.strategy_id)}
                            title="Pause strategy"
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                        ) : strategy.status === 'paused' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resumeMutation.mutate(strategy.strategy_id)}
                            title="Resume strategy"
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EditStrategyModal
        strategy={editingStrategy}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
      />
    </div>
  );
} 