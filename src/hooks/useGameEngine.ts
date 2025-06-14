
import { useMemo, useCallback, useEffect } from 'react';
import { GameData, PlayerData } from '@/types/game';
import { usePersistentQueue } from './usePersistentQueue';
import { useGameMetricsIntegration } from './useGameMetricsIntegration';
import { useGameState } from './game-engine/useGameState';
import { useGameStatus } from './game-engine/useGameStatus';
import { useGameSync } from './game-engine/useGameSync';
import { useGameActions } from './game-engine/useGameActions';

interface UseGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

export const useGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseGameEngineProps) => {
  // State management hooks
  const { gameState, setGameState, playersState, setPlayersState } = useGameState({ initialGameData, initialPlayers });
  const { currentAction, setCurrentAction, syncStatus, setSyncStatus, isProcessingMove } = useGameStatus();

  // Core services hooks
  const persistentQueue = usePersistentQueue({
    gameId: gameState.id,
    maxItems: 50,
    maxAge: 600000 // 10 minutos
  });

  const gameMetrics = useGameMetricsIntegration({
    syncStatus,
    isProcessingMove,
    pendingMovesCount: persistentQueue.size,
    gameId: gameState.id
  });

  // Computed values
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  
  // Action and Sync hooks
  const { forceSync } = useGameSync({
    gameId: gameState.id,
    userId,
    setGameState,
    setPlayersState,
    setSyncStatus,
    gameMetrics
  });

  const { playPiece, passTurn, playAutomatic } = useGameActions({
    gameState,
    playersState,
    userId,
    isMyTurn,
    isProcessingMove,
    setGameState,
    setPlayersState,
    setCurrentAction,
    setSyncStatus,
    persistentQueue,
    gameMetrics
  });
  
  // Health and utility functions
  const getStateHealth = useCallback(() => {
    const queueStats = persistentQueue.getStats();
    const healthStatus = gameMetrics.getHealthStatus();
    
    return {
      syncStatus,
      pendingOperations: persistentQueue.size,
      fallbackQueue: 0, // Conceito removido
      persistentQueue: queueStats.total,
      isHealthy: syncStatus === 'synced' && persistentQueue.size === 0 && healthStatus.status === 'healthy',
      lastSyncAttempt: Date.now(),
      stats: {}, // Stub
      systemStats: {}, // Stub
      healthMetrics: healthStatus
    };
  }, [syncStatus, persistentQueue, gameMetrics]);

  // Auto-cleanup for persistent queue
  useEffect(() => {
    const interval = setInterval(() => {
      persistentQueue.cleanupExpired();
    }, 60000);

    return () => clearInterval(interval);
  }, [persistentQueue]);
  
  // Expose the public API, ensuring it matches the original contract
  return {
    // States
    gameState,
    playersState,
    
    // Actions
    playPiece,
    passTurn,
    playAutomatic,
    forceSync,
    
    // Status
    isMyTurn,
    isProcessingMove,
    currentAction,
    syncStatus,
    
    // Metrics
    pendingMovesCount: persistentQueue.size,
    fallbackQueueSize: 0,
    persistentQueueSize: persistentQueue.size,
    
    // Utilities
    getStateHealth,
    
    // Debug
    debugInfo: {
      pendingOperations: persistentQueue.size,
      fallbackQueue: 0,
      persistentQueue: persistentQueue.size,
      conflictCount: 0, 
      lastSyncAttempt: Date.now(),
      stats: {},
      systemStats: {},
      healthMetrics: gameMetrics.getHealthStatus()
    }
  };
};
