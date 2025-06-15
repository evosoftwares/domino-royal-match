
import { useMemo, useCallback, useEffect } from 'react';
import { GameData, PlayerData } from '@/types/game';
import { useGameState } from './game-engine/useGameState';
import { useGameStatus } from './game-engine/useGameStatus';
import { useRealtimeSync } from './useRealtimeSync';
import { useGameActions } from './game-engine/useGameActions';
import { supabase } from '@/integrations/supabase/client';

interface UseSimpleGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

export const useSimpleGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseSimpleGameEngineProps) => {
  // Estado simplificado
  const { gameState, setGameState, playersState, setPlayersState } = useGameState({ 
    initialGameData, 
    initialPlayers 
  });
  
  const { currentAction, setCurrentAction, syncStatus, setSyncStatus, isProcessingMove } = useGameStatus();

  // Computed values
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  
  // Sincronização realtime simplificada
  useRealtimeSync({
    gameId: gameState.id,
    userId,
    onGameUpdate: (updatedGame) => {
      setGameState(updatedGame);
    },
    onPlayerUpdate: (updatedPlayer) => {
      setPlayersState(prev => prev.map(p => 
        p.id === updatedPlayer.id ? updatedPlayer : p
      ));
    },
    onConnectionStatusChange: (status) => {
      setSyncStatus(status === 'connected' ? 'synced' : 'failed');
    }
  });

  // Ações do jogo com mock simples para as dependências
  const mockPersistentQueue = {
    addItem: () => {},
    cleanupExpired: () => {},
    size: 0,
    getStats: () => ({ total: 0 })
  };

  const mockGameMetrics = {
    recordGameAction: (action: string) => console.log(`Action: ${action}`),
    recordGameSuccess: (operation: string, time?: number) => console.log(`Success: ${operation}`),
    recordGameError: (operation: string, error: any, time?: number) => console.error(`Error: ${operation}`, error),
    getHealthStatus: () => ({ status: 'healthy' as const })
  };

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
    persistentQueue: mockPersistentQueue,
    gameMetrics: mockGameMetrics
  });
  
  // Função de sincronização forçada simplificada
  const forceSync = useCallback(async () => {
    try {
      setSyncStatus('pending');
      
      const [gameResult, playersResult] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameState.id).single(),
        supabase.from('game_players').select('*').eq('game_id', gameState.id)
      ]);

      if (gameResult.data) {
        setGameState(gameResult.data);
      }
      
      if (playersResult.data) {
        setPlayersState(playersResult.data);
      }
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      setSyncStatus('failed');
    }
  }, [gameState.id, setGameState, setPlayersState, setSyncStatus]);

  // API pública simplificada
  return {
    // Estados
    gameState,
    playersState,
    
    // Ações
    playPiece,
    passTurn,
    playAutomatic,
    forceSync,
    
    // Status
    isMyTurn,
    isProcessingMove,
    currentAction,
    syncStatus,
    
    // Métricas simplificadas
    pendingMovesCount: 0,
    
    // Debug simplificado
    debugInfo: {
      syncStatus,
      isProcessingMove,
      currentAction
    }
  };
};
