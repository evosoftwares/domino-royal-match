import { useCallback, useEffect } from 'react';
import { useSystemHealthMonitor } from './useSystemHealthMonitor';

interface GameMetricsIntegrationProps {
  syncStatus: 'synced' | 'pending' | 'conflict' | 'failed';
  isProcessingMove: boolean;
  pendingMovesCount: number;
  gameId: string;
}

export const useGameMetricsIntegration = ({
  syncStatus,
  isProcessingMove,
  pendingMovesCount,
  gameId
}: GameMetricsIntegrationProps) => {
  const {
    recordSuccess,
    recordError,
    getHealthStatus
  } = useSystemHealthMonitor();

  // Record game actions
  const recordGameAction = useCallback((action: string) => {
    console.log(`🎬 Ação do jogo: ${action}`);
  }, []);

  // Record successful operations
  const recordGameSuccess = useCallback((operation: string, responseTime?: number) => {
    console.log(`✅ ${operation} executado com sucesso`);
    recordSuccess(responseTime);
  }, [recordSuccess]);

  // Record failed operations
  const recordGameError = useCallback((operation: string, error: any, responseTime?: number) => {
    console.error(`❌ ${operation} falhou:`, error);
    recordError(responseTime, error);
  }, [recordError]);

  // Monitor sync status changes
  useEffect(() => {
    if (syncStatus === 'synced' && !isProcessingMove) {
      recordGameSuccess('Sync Operation', 150); // Simulate response time
    } else if (syncStatus === 'failed') {
      recordGameError('Sync Operation', new Error('Sync failed'), 3000);
    }
  }, [syncStatus, isProcessingMove, recordGameSuccess, recordGameError]);

  // Monitor pending moves
  useEffect(() => {
    if (pendingMovesCount > 5) {
      recordGameError('Queue Management', new Error(`Too many pending moves: ${pendingMovesCount}`));
    }
  }, [pendingMovesCount, recordGameError]);

  return {
    recordGameAction,
    recordGameSuccess,
    recordGameError,
    getHealthStatus
  };
};
