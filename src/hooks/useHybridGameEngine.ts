
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { useOptimizedPendingMoves } from './useOptimizedPendingMoves';
import { useRealtimeSync } from './useRealtimeSync';
import { useServerSync } from './useServerSync';
import { useLocalGameState } from './useLocalGameState';
import { useGameDataValidator } from './useGameDataValidator';
import { useGamePerformanceOptimizer } from './useGamePerformanceOptimizer';

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

  // Validation and optimization hooks
  const { validateGameData, clearCache: clearValidationCache } = useGameDataValidator();
  const { measureValidation, optimizePieceArray, getPerformanceReport, resetMetrics } = useGamePerformanceOptimizer();

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
      console.log('✅ Movimento sincronizado com sucesso:', moveId);
    },
    onMoveFailure: (moveId, error) => {
      console.error('❌ Falha ao sincronizar movimento:', moveId, error);
      toast.error('Falha ao sincronizar movimento');
    }
  });

  // Validação automática do estado do jogo
  useEffect(() => {
    const validateCurrentState = () => {
      try {
        const validation = validateGameData(gameState, playersState);
        
        if (!validation.isValid) {
          console.error('🚨 Estado do jogo inválido:', validation.errors);
          validation.errors.forEach(error => console.error('  -', error));
        }
        
        if (validation.warnings.length > 0) {
          console.warn('⚠️ Avisos no estado do jogo:', validation.warnings);
          validation.warnings.forEach(warning => console.warn('  -', warning));
        }

        // Log de estatísticas periodicamente (a cada 10 validações)
        if (validation.stats.totalPieces > 0 && Math.random() < 0.1) {
          console.log('📈 Stats do jogo:', validation.stats);
        }
      } catch (error) {
        console.error('❌ Erro durante validação automática:', error);
      }
    };

    validateCurrentState();
  }, [gameState, playersState, validateGameData]);

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const report = getPerformanceReport();
      if (report.pieceValidations > 50) {
        // Log relatório apenas se houver atividade significativa
        console.log('📊 Relatório de performance automático gerado');
      }
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, [getPerformanceReport]);

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
        console.log('🔄 Atualizando estado do jogo via realtime:', newGameData.id);
        updateGameState(newGameData);
      }, 150);
    },
    onPlayerUpdate: (updatedPlayer) => {
      debouncedStateUpdate(() => {
        console.log('👤 Atualizando estado do jogador via realtime:', updatedPlayer.user_id);
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
    return await measureValidation(async () => {
      try {
        if (move.type === 'play' && move.piece) {
          return await serverSync.syncPlayMove(move.piece);
        } else if (move.type === 'pass') {
          return await serverSync.syncPassTurn();
        }
        return false;
      } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        return false;
      }
    }, `syncWithServer(${move.type})`);
  }, [serverSync, measureValidation]);

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
    return await measureValidation(async () => {
      if (isProcessingMove) {
        console.warn("⚠️ Tentativa de jogar enquanto processando movimento anterior");
        return false;
      }

      if (!userId || gameState.current_player_turn !== userId) {
        toast.error("Não é sua vez de jogar.");
        return false;
      }

      setCurrentAction('playing');
      console.log('🎯 Jogando peça padronizada:', { top: piece.top, bottom: piece.bottom });

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
        console.error('❌ Erro ao jogar peça:', error);
        toast.error('Erro ao jogar peça');
        return false;
      } finally {
        setCurrentAction(null);
      }
    }, 'playPiece');
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalMove, pendingMoves, measureValidation]);

  const passTurn = useCallback(async () => {
    return await measureValidation(async () => {
      if (isProcessingMove) {
        console.warn("⚠️ Tentativa de passar enquanto processando ação anterior");
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
        console.error('❌ Erro ao passar a vez:', error);
        toast.error('Erro ao passar a vez');
        return false;
      } finally {
        setCurrentAction(null);
      }
    }, 'passTurn');
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalPass, pendingMoves, measureValidation]);

  const playAutomatic = useCallback(async () => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    
    try {
      const success = await serverSync.syncAutoPlay();
      
      if (success) {
        toast.success('Jogada automática realizada!');
        console.log('🤖 Auto play executado com sucesso');
      } else {
        toast.error('Erro no jogo automático');
        console.error('❌ Falha no auto play');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Erro no auto play:', error);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [gameState.id, isProcessingMove, serverSync]);

  // Utility functions for debugging and optimization
  const debugUtils = useMemo(() => ({
    validateCurrentState: () => validateGameData(gameState, playersState),
    getPerformanceReport,
    resetMetrics,
    clearValidationCache,
    optimizePieceArray
  }), [validateGameData, gameState, playersState, getPerformanceReport, resetMetrics, clearValidationCache, optimizePieceArray]);

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
    connectionStatus,
    debugUtils // Ferramentas de debug e otimização
  };
};
