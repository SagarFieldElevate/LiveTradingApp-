import React, { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store';
import { StrategyDashboard } from './components/StrategyDashboard';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { TradeHistory } from './components/TradeHistory';
import { StrategyApprovalModal } from './components/StrategyApprovalModal';
import { KillSwitch } from './components/KillSwitch';
import { MarketStatus } from './components/MarketStatus';

const queryClient = new QueryClient();

function App() {
  const { setSocket, setMarketConnected } = useStore();
  const [activeTab, setActiveTab] = React.useState('strategies');

  useEffect(() => {
    const socket: Socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
      console.log('Connected to server');
      setSocket(socket);
    });

    socket.on('market:connected', () => {
      setMarketConnected(true);
    });

    socket.on('market:disconnected', () => {
      setMarketConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [setSocket, setMarketConnected]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-2xl font-bold">Live Trading Execution</h1>
              <div className="flex items-center gap-4">
                <MarketStatus />
                <KillSwitch />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-4">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('strategies')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'strategies'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Strategies
                </button>
                <button
                  onClick={() => setActiveTab('portfolio')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'portfolio'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Portfolio
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'history'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Trade History
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-4">
              {activeTab === 'strategies' && <StrategyDashboard />}
              {activeTab === 'portfolio' && <PortfolioDashboard />}
              {activeTab === 'history' && <TradeHistory />}
            </div>
          </div>
        </main>

        <StrategyApprovalModal />
      </div>
    </QueryClientProvider>
  );
}

export default App; 