import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertTriangle } from 'lucide-react';

export function KillSwitch() {
  const [authCode, setAuthCode] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const emergencyCloseMutation = useMutation({
    mutationFn: async () => {
      return api.post('/trading/emergency/close-all', {
        reason: 'Manual emergency close',
        auth_code: authCode,
      });
    },
    onSuccess: () => {
      alert('Emergency Close Initiated - All positions are being closed.');
      setIsOpen(false);
    },
    onError: (error: any) => {
      alert(`Emergency Close Failed: ${error.response?.data?.error || 'Unknown error'}`);
    },
  });

  return (
    <>
      <Button 
        variant="destructive" 
        size="lg"
        onClick={() => setIsOpen(true)}
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        KILL SWITCH
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Emergency Close All Positions</h2>
            <p className="text-gray-600 mb-4">
              This will immediately close ALL open positions at market price.
              This action cannot be undone.
            </p>
            <div className="my-4">
              <Input
                type="password"
                placeholder="Enter emergency auth code"
                value={authCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthCode(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => emergencyCloseMutation.mutate()}
                disabled={!authCode || emergencyCloseMutation.isPending}
              >
                Close All Positions
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 