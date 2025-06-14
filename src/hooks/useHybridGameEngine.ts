
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { useOptimizedPendingMoves } from './useOptimizedPendingMoves';
import { useRealtimeSync } from './useRealtimeSync';
import { useServerSync } from './useServerSync';
import { useLocalGameState } from './useLocalGameState';

interface UseHybridGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;

export const useHybridGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseHybridGameEngineProps) => {
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  
  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Local game state management
  const {
    gameState,
    playersState,
    applyLocalMove,
    applyLocalPass,
    updateGameState,
    updatePlayerState
  } = useLocalGameState({
    initialGameData,
    initialPlayers,
    userId
  });

  // Server synchronization
  const serverSync = useServerSync({
    gameId: gameState.id,
    boardState: gameState.board_state
  });

  // Pending moves management
  const pendingMoves = useOptimizedPendingMoves({
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 8000,
    onMoveSuccess: (moveId) => {
      console.log('Movimento sincronizado com sucesso:', moveId);
    },
    onMoveFailure: (moveId, error) => {
      console.error('Falha ao sincronizar movimento:', moveId, error);
      toast.error('Falha ao sincronizar movimento');
    }
  });

  // Debounced update function
  const debouncedStateUpdate = useCallback((updateFn: () => void, delay: number = 200) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateFn();
    }, delay);
  }, []);

  // Realtime synchronization
  useRealtimeSync({
    gameId: gameState.id,
    userId,
    onGameUpdate: (newGameData) => {
      debouncedStateUpdate(() => {
        updateGameState(newGameData);
      }, 150);
    },
    onPlayerUpdate: (updatedPlayer) => {
      debouncedStateUpdate(() => {
        updatePlayerState(updatedPlayer);
      }, 150);
    },
    onConnectionStatusChange: setConnectionStatus
  });

  // Computed values
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  const isProcessingMove = pendingMoves.isProcessing || currentAction !== null;

  // Sync function for pending moves
  const syncWithServer = useCallback(async (move: any) => {
    try {
      if (move.type === 'play' && move.piece) {
        return await serverSync.syncPlayMove(move.piece);
      } else if (move.type === 'pass') {
        return await serverSync.syncPassTurn();
      }
      return false;
    } catch (error) {
      console.error('Erro na sincronização:', error);
      return false;
    }
  }, [serverSync]);

  // Auto-process pending moves
  useEffect(() => {
    if (pendingMoves.pendingCount > 0) {
      const nextMove = pendingMoves.getNextMoveToProcess();
      if (nextMove) {
        pendingMoves.processNextMove(syncWithServer);
      }
    }
  }, [pendingMoves, syncWithServer]);

  // Game actions
  const playPiece = useCallback(async (piece: DominoPieceType) => {
    if (isProcessingMove) {
      console.warn("Tentativa de jogar enquanto processando movimento anterior");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de jogar.");
      return false;
    }

    setCurrentAction('playing');
    console.log('Jogando peça padronizada:', { top: piece.top, bottom: piece.bottom });

    try {
      const localSuccess = applyLocalMove(piece);
      
      if (!localSuccess) {
        toast.error('Jogada inválida');
        return false;
      }

      pendingMoves.addPendingMove({
        type: 'play',
        piece,
        priority: 1
      });

      toast.success('Peça jogada (aguardando sincronização)!');
      return true;
    } catch (error) {
      console.error('Erro ao jogar peça:', error);
      toast.error('Erro ao jogar peça');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalMove, pendingMoves]);

  const passTurn = useCallback(async () => {
    if (isProcessingMove) {
      console.warn("Tentativa de passar enquanto processando ação anterior");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de passar.");
      return false;
    }

    setCurrentAction('passing');

    try {
      applyLocalPass();

      pendingMoves.addPendingMove({
        type: 'pass',
        priority: 2
      });

      toast.info('Você passou a vez (aguardando sincronização).');
      return true;
    } catch (error) {
      console.error('Erro ao passar a vez:', error);
      toast.error('Erro ao passar a vez');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalPass, pendingMoves]);

  const playAutomatic = useCallback(async () => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    
    try {
      const success = await serverSync.syncAutoPlay();
      
      if (success) {
        toast.success('Jogada automática realizada!');
      } else {
        toast.error('Erro no jogo automático');
      }
      
      return success;
    } catch (error) {
      console.error('Erro no auto play:', error);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [gameState.id, isProcessingMove, serverSync]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
    };
  }, []);

  return {
    gameState,
    playersState,
    playPiece,
    passTurn,
    playAutomatic,
    isMyTurn,
    isProcessingMove,
    currentAction,
    retryCount: 0, // Deprecated - usar pendingMoves.pendingCount
    pendingMovesCount: pendingMoves.pendingCount,
    connectionStatus
  };
};
