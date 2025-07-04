import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import { ParsedStrategy, Position, Portfolio } from '../types';

interface Store {
  // Socket
  socket: Socket | null;
  setSocket: (socket: Socket) => void;

  // Market Status
  marketConnected: boolean;
  setMarketConnected: (connected: boolean) => void;

  // Strategies
  strategies: ParsedStrategy[];
  setStrategies: (strategies: ParsedStrategy[]) => void;
  pendingStrategy: ParsedStrategy | null;
  setPendingStrategy: (strategy: ParsedStrategy | null) => void;

  // Portfolio
  portfolio: Portfolio | null;
  setPortfolio: (portfolio: Portfolio) => void;
  positions: Position[];
  setPositions: (positions: Position[]) => void;

  // UI State
  showApprovalModal: boolean;
  setShowApprovalModal: (show: boolean) => void;
  isEmergencyMode: boolean;
  setEmergencyMode: (mode: boolean) => void;
}

export const useStore = create<Store>((set) => ({
  socket: null,
  setSocket: (socket) => set({ socket }),

  marketConnected: false,
  setMarketConnected: (connected) => set({ marketConnected: connected }),

  strategies: [],
  setStrategies: (strategies) => set({ strategies }),
  pendingStrategy: null,
  setPendingStrategy: (strategy) => set({ pendingStrategy: strategy }),

  portfolio: null,
  setPortfolio: (portfolio) => set({ portfolio }),
  positions: [],
  setPositions: (positions) => set({ positions }),

  showApprovalModal: false,
  setShowApprovalModal: (show) => set({ showApprovalModal: show }),
  isEmergencyMode: false,
  setEmergencyMode: (mode) => set({ isEmergencyMode: mode }),
})); 