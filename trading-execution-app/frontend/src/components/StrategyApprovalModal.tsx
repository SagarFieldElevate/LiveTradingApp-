import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RefreshCw } from 'lucide-react';

export function StrategyApprovalModal() {
  const { pendingStrategy, showApprovalModal, setShowApprovalModal, setPendingStrategy, socket } = useStore();
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [positionSize, setPositionSize] = useState('100');
  const [enableTrailing, setEnableTrailing] = useState(true);
  const [comments, setComments] = useState('');
  const [isReparsing, setIsReparsing] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.put(`/strategies/${pendingStrategy?.strategy_id}/approve`, data);
    },
    onSuccess: () => {
      setShowApprovalModal(false);
      // Reset form
      setStopLoss('');
      setTakeProfit('');
      setPositionSize('100');
      setComments('');
    },
  });

  const reparseMutation = useMutation({
    mutationFn: async () => {
      setIsReparsing(true);
      return api.post(`/strategies/${pendingStrategy?.strategy_id}/reparse`, { comments });
    },
    onSuccess: (response) => {
      setComments('');
      setIsReparsing(false);
      // Update the strategy data directly without page refresh
      if (response.data?.strategy) {
        setPendingStrategy(response.data.strategy);
      }
    },
    onError: () => {
      setIsReparsing(false);
    }
  });

  const refreshParseMutation = useMutation({
    mutationFn: async () => {
      setIsReparsing(true);
      return api.post(`/strategies/${pendingStrategy?.strategy_id}/reparse`, { 
        force_refresh: true,
        comments: '' 
      });
    },
    onSuccess: (response) => {
      setIsReparsing(false);
      // Update the strategy data directly without page refresh
      if (response.data?.strategy) {
        setPendingStrategy(response.data.strategy);
      }
    },
    onError: () => {
      setIsReparsing(false);
    }
  });

  // Prevent WebSocket events from interfering with the modal during reparsing
  useEffect(() => {
    if (!socket || !showApprovalModal || !pendingStrategy) return;

    const handleStrategyReparsed = (reparsedStrategy: any) => {
      // Only update if it's the same strategy and we're not currently reparsing
      if (reparsedStrategy.strategy_id === pendingStrategy.strategy_id && !isReparsing) {
        setPendingStrategy(reparsedStrategy);
      }
    };

    socket.on('strategy:reparsed', handleStrategyReparsed);

    return () => {
      socket.off('strategy:reparsed', handleStrategyReparsed);
    };
  }, [socket, showApprovalModal, pendingStrategy?.strategy_id, isReparsing, setPendingStrategy]);

  if (!pendingStrategy || !showApprovalModal) return null;

  const handleApprove = () => {
    if (!stopLoss || parseFloat(stopLoss) <= 0) {
      alert('Please enter a valid stop loss percentage.');
      return;
    }

    approveMutation.mutate({
      stop_loss_percent: parseFloat(stopLoss),
      take_profit_percent: parseFloat(takeProfit) || 0,
      position_size: parseFloat(positionSize),
      enable_trailing: enableTrailing,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Strategy Approval Required</h2>
        <p className="text-gray-600 mb-6">
          Review the AI-parsed conditions and set risk parameters before activating.
        </p>

        <div className="space-y-4">
          {/* Original Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Original Strategy Description</label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md text-sm">
              {pendingStrategy.description}
            </div>
          </div>

          {/* Parsed Conditions */}
          <div className="relative">
            {isReparsing && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-md">
                <div className="flex items-center gap-2 text-blue-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">AI is re-parsing strategy...</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">AI-Parsed Entry Conditions</label>
              <button
                onClick={() => refreshParseMutation.mutate()}
                disabled={isReparsing || refreshParseMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                title="Re-parse with fresh OpenAI call"
              >
                <RefreshCw className={`w-3 h-3 ${isReparsing ? 'animate-spin' : ''}`} />
                {isReparsing ? 'Re-parsing...' : 'Refresh AI Parse'}
              </button>
            </div>
            <div className="mt-1 p-3 bg-gray-100 rounded-md space-y-2">
              {pendingStrategy.entry_conditions ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {pendingStrategy.entry_conditions.type || 'unknown'}
                    </span>
                    {pendingStrategy.entry_conditions.target_asset && (
                      <span className="text-sm font-medium">
                        Target: {pendingStrategy.entry_conditions.target_asset}
                      </span>
                    )}
                    {pendingStrategy.entry_conditions.primary_asset && (
                      <span className="text-sm">
                        {pendingStrategy.entry_conditions.primary_asset}
                      </span>
                    )}
                  </div>
                  
                  {/* Multi-asset triggers */}
                  {pendingStrategy.entry_conditions.triggers && pendingStrategy.entry_conditions.triggers.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Triggers (ALL required):</p>
                      {pendingStrategy.entry_conditions.triggers.map((trigger: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm bg-white px-2 py-1 rounded">
                          <span className="bg-green-100 text-green-800 px-1 rounded text-xs">
                            {trigger.asset}
                          </span>
                          <span>→ {trigger.direction} movement</span>
                          {trigger.threshold_percent && (
                            <span className="text-gray-600">({trigger.threshold_percent}%)</span>
                          )}
                        </div>
                      ))}
                      {pendingStrategy.entry_conditions.delay_days && (
                        <p className="text-sm text-gray-600">
                          Execute {pendingStrategy.entry_conditions.action} {pendingStrategy.entry_conditions.delay_days} day(s) after triggers
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Single asset trigger */
                    <p className="text-sm">
                      Trigger: {pendingStrategy.entry_conditions.direction || 'up'} move of{' '}
                      {pendingStrategy.entry_conditions.threshold || 0.02}%
                    </p>
                  )}
                  
                  {pendingStrategy.entry_conditions.secondary_asset && (
                    <p className="text-sm text-gray-600">
                      Correlation with {pendingStrategy.entry_conditions.secondary_asset}:{' '}
                      {pendingStrategy.entry_conditions.additional_params?.correlation_threshold}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Entry conditions not parsed yet</p>
              )}
            </div>
          </div>

          {/* Exit Conditions */}
          <div>
            <label className="block text-sm font-medium mb-1">AI-Parsed Exit Conditions</label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md space-y-2">
              {pendingStrategy.exit_conditions?.stop_loss ? (
                <p className="text-sm">
                  Stop Loss: {pendingStrategy.exit_conditions.stop_loss.value}x{' '}
                  {pendingStrategy.exit_conditions.stop_loss.type?.toUpperCase() || 'PERCENTAGE'}
                  {pendingStrategy.exit_conditions.stop_loss.is_trailing && ' (Trailing)'}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Stop Loss: Not specified</p>
              )}
              
              {pendingStrategy.exit_conditions?.take_profit ? (
                <p className="text-sm">
                  Take Profit: {pendingStrategy.exit_conditions.take_profit.value}x{' '}
                  {pendingStrategy.exit_conditions.take_profit.type?.toUpperCase() || 'PERCENTAGE'}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Take Profit: Not specified</p>
              )}
              
              {pendingStrategy.exit_conditions?.max_hold_period && (
                <p className="text-sm">
                  Max Hold: {pendingStrategy.exit_conditions.max_hold_period.value}{' '}
                  {pendingStrategy.exit_conditions.max_hold_period.unit}
                </p>
              )}
            </div>
          </div>

          {/* Required Assets */}
          <div>
            <label className="block text-sm font-medium mb-1">Assets to Monitor</label>
            <div className="mt-1 flex gap-2">
              {pendingStrategy.required_assets && pendingStrategy.required_assets.length > 0 ? (
                pendingStrategy.required_assets.map((asset) => (
                  <span key={asset} className="bg-gray-200 px-2 py-1 rounded text-sm">
                    {asset}
                  </span>
                ))
              ) : (
                <span className="bg-gray-200 px-2 py-1 rounded text-sm">
                  BTC-USD
                </span>
              )}
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              Set your risk parameters. Stop loss is required for all strategies.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="stop-loss" className="block text-sm font-medium mb-1">
                Stop Loss % <span className="text-red-500">*</span>
              </label>
              <input
                id="stop-loss"
                type="number"
                step="0.1"
                placeholder="2.0"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md ${
                  !stopLoss ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            <div>
              <label htmlFor="take-profit" className="block text-sm font-medium mb-1">
                Take Profit %
              </label>
              <input
                id="take-profit"
                type="number"
                step="0.1"
                placeholder="5.0"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="position-size" className="block text-sm font-medium mb-1">
                Position Size ($)
              </label>
              <input
                id="position-size"
                type="number"
                step="1"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex items-center">
              <input
                id="trailing-stop"
                type="checkbox"
                checked={enableTrailing}
                onChange={(e) => setEnableTrailing(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="trailing-stop" className="text-sm">
                Enable Trailing Stop
              </label>
            </div>
          </div>

          {/* Re-parse Comments */}
          <div>
            <label htmlFor="comments" className="block text-sm font-medium mb-1">
              Comments for Re-parsing (Optional)
            </label>
            <textarea
              id="comments"
              rows={3}
              placeholder="Add clarifications for better parsing..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowApprovalModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reparseMutation.mutate()}
            disabled={!comments || isReparsing || reparseMutation.isPending}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {isReparsing ? 'Re-parsing...' : 'Re-parse with Comments'}
          </button>
          <button
            onClick={handleApprove}
            disabled={!stopLoss || approveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Approve & Activate
          </button>
        </div>
      </div>
    </div>
  );
} 