import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Badge } from './ui/badge';
import { Circle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

export function MarketStatus() {
  const { marketConnected, socket } = useStore();
  const [monitoringStatus, setMonitoringStatus] = useState<any>(null);

  const { data } = useQuery({
    queryKey: ['monitoring-status'],
    queryFn: () => api.get('/monitoring/status') as Promise<any>,
    refetchInterval: 10000, // Check every 10 seconds
  });

  useEffect(() => {
    if (data) {
      setMonitoringStatus(data);
    }
  }, [data]);

  useEffect(() => {
    if (!socket) return;

    socket.on('monitor:stats', (stats: any) => {
      setMonitoringStatus((prev: any) => ({
        ...prev,
        monitoring: {
          ...prev?.monitoring,
          ...stats,
        },
      }));
    });

    return () => {
      socket.off('monitor:stats');
    };
  }, [socket]);

  const getStatusColor = () => {
    if (!marketConnected) return 'bg-red-500';
    if (!monitoringStatus?.monitoring?.active) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!marketConnected) return 'Market Data Disconnected';
    if (!monitoringStatus?.monitoring?.active) return 'Monitoring Paused';
    return 'System Active';
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer"
        >
          <Circle className={`mr-2 h-2 w-2 ${getStatusColor()}`} />
          {getStatusText()}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium">System Status</h4>
          
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Market Data</span>
              <Badge variant={marketConnected ? 'default' : 'destructive'}>
                {marketConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            
            {monitoringStatus && (
              <>
                <div className="flex justify-between">
                  <span>Monitoring</span>
                  <Badge variant={monitoringStatus.monitoring?.active ? 'default' : 'secondary'}>
                    {monitoringStatus.monitoring?.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                <div className="flex justify-between">
                  <span>Active Strategies</span>
                  <span>{monitoringStatus.monitoring?.activeStrategies || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Subscribed Symbols</span>
                  <span>{monitoringStatus.market_data?.subscribed_symbols?.length || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Check Count</span>
                  <span>{monitoringStatus.monitoring?.check_count || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Last Check Time</span>
                  <span>{monitoringStatus.monitoring?.lastCheckTime || 0}ms</span>
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 