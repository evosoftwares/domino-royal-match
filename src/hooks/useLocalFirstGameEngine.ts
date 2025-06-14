
import { useState, useCallback, useEffect, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { useOptimisticGameActions } from './useOptimisticGameActions';
import { useRealtimeSync } from './useRealtimeSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseLocalFirstGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';
type ActionType = 'playing' | 'passing' | 'auto_playing' | null;

export const useLocalFirstGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseLocalFirstGameEngineProps) => {
  // Estados locais principais
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Função para atualizar estado (usada pelo Two-Phase Commit)
  const handleStateUpdate = useCallback((newGameState: GameData, newPlayersState: PlayerData[]) => {
    setGameState(newGameState);
    setPlayersState(newPlayersState);
  }, []);

  // Hook de ações otimistas
  const {
    playPiece: optimisticPlayPiece,
    passTurn: optimisticPassTurn,
    isProcessingMove,
    pendingOperationsCount,
    stats
  } = useOptimisticGameActions({
    gameState,
    playersState,
    userId,
    onStateUpdate: handleStateUpdate
  });

  // Sincronização em tempo real
  useRealtimeSync({
    gameId: gameState.id,
    userId,
    onGameUpdate: (updatedGame) => {
      console.log('📥 Atualização do jogo recebida via realtime');
      setGameState(updatedGame);
      setSyncStatus('synced');
    },
    onPlayerUpdate: (updatedPlayer) => {
      console.log('📥 Atualização de jogador recebida via realtime');
      setPlayersState(prev => 
        prev.map(player => 
          player.user_id === updatedPlayer.user_id ? updatedPlayer : player
        )
      );
    },
    onConnectionStatusChange: (status) => {
      setSyncStatus(status === 'connected' ? 'synced' : 'failed');
    }
  });

  // Valores computados
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);

  // AÇÕES PÚBLICAS - Envolvidas com Two-Phase Commit
  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      return false;
    }

    setCurrentAction('playing');
    const result = await optimisticPlayPiece(piece);
    setCurrentAction(null);
    
    return result;
  }, [isMyTurn, isProcessingMove, optimisticPlayPiece]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      return false;
    }

    setCurrentAction('passing');
    const result = await optimisticPassTurn();
    setCurrentAction(null);
    
    return result;
  }, [isMyTurn, isProcessingMove, optimisticPassTurn]);

  // Auto play (mantido do código original)
  const playAutomatic = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    
    try {
      const { data, error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) throw error;
      
      toast.success('Jogada automática realizada!');
      return true;
    } catch (error) {
      console.error('❌ Erro no auto play:', error);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, gameState.id]);

  // Funções de utilidade
  const getStateHealth = useCallback(() => {
    return {
      syncStatus,
      pendingOperations: pendingOperationsCount,
      isHealthy: syncStatus === 'synced' && pendingOperationsCount === 0,
      lastSyncAttempt: Date.now(),
      stats
    };
  }, [syncStatus, pendingOperationsCount, stats]);

  const forceSync = useCallback(() => {
    console.log('🔧 Forçando sincronização...');
    // Implementar se necessário
  }, []);

  // Sincronizar estados iniciais quando props mudam
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  return {
    // Estados
    gameState,
    playersState,
    
    // Ações
    playPiece,
    passTurn,
    playAutomatic,
    
    // Status
    isMyTurn,
    isProcessingMove,
    currentAction,
    syncStatus,
    
    // Métricas
    pendingMovesCount: pendingOperationsCount,
    
    // Utilities
    getStateHealth,
    forceSync,
    
    // Debug
    debugInfo: {
      pendingOperations: pendingOperationsCount,
      conflictCount: 0,
      lastSyncAttempt: Date.now(),
      stats
    }
  };
};
