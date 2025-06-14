
import { useState, useCallback, useEffect, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { useRealtimeSync } from './useRealtimeSync';
import { usePersistentQueue } from './usePersistentQueue';
import { useGameMetricsIntegration } from './useGameMetricsIntegration';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOptimisticLocking } from './useOptimisticLocking';
import { standardizePieceFormat, validateMove } from '@/utils/standardPieceValidation';
import { getNextPlayerId, calculateNewBoardState, removePieceFromHand } from '@/utils/gameLogic';

interface UseGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';
type ActionType = 'playing' | 'passing' | 'auto_playing' | 'syncing' | null;

export const useGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseGameEngineProps) => {
  // Estados locais principais
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // Fila persistente para recuperação de operações
  const persistentQueue = usePersistentQueue({
    gameId: gameState.id,
    maxItems: 50,
    maxAge: 600000 // 10 minutos
  });

  // Função para atualizar estado
  const handleStateUpdate = useCallback((newGameState: Partial<GameData>, newPlayersState: PlayerData[]) => {
    setGameState(prev => ({...prev, ...newGameState}));
    setPlayersState(newPlayersState);
  }, []);

  // Hook de locking otimista
  const { executeGameOperation, executePlayerOperation } = useOptimisticLocking();

  // Integração de métricas do jogo
  const gameMetrics = useGameMetricsIntegration({
    syncStatus,
    isProcessingMove: currentAction !== null,
    pendingMovesCount: persistentQueue.size,
    gameId: gameState.id
  });

  // Sincronização em tempo real
  useRealtimeSync({
    gameId: gameState.id,
    userId,
    onGameUpdate: (updatedGame) => {
      console.log('📥 Atualização do jogo recebida via realtime');
      setGameState(updatedGame);
      setSyncStatus('synced');
      gameMetrics.recordGameSuccess('Realtime Game Update');
    },
    onPlayerUpdate: (updatedPlayer) => {
      console.log('📥 Atualização de jogador recebida via realtime');
      setPlayersState(prev => 
        prev.map(player => 
          player.user_id === updatedPlayer.user_id ? updatedPlayer : player
        )
      );
      gameMetrics.recordGameSuccess('Realtime Player Update');
    },
    onConnectionStatusChange: (status) => {
      const newSyncStatus: SyncStatus = status === 'connected' ? 'synced' : 'failed';
      setSyncStatus(newSyncStatus);
      
      if (status === 'disconnected') {
        gameMetrics.recordGameError('Connection Lost', new Error('Realtime connection lost'));
      } else if (status === 'connected') {
        gameMetrics.recordGameSuccess('Connection Restored');
      }
    }
  });

  // Valores computados
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  const isProcessingMove = useMemo(() => currentAction !== null, [currentAction]);

  // AÇÕES PÚBLICAS - Envolvidas com Two-Phase Commit + Circuit Breaker
  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      toast.warning('Aguarde, processando jogada anterior ou não é sua vez.');
      return false;
    }

    setCurrentAction('playing');
    setSyncStatus('pending');
    gameMetrics.recordGameAction('playPiece_start');
    
    const startTime = performance.now();
    
    persistentQueue.addItem({ type: 'play_move', data: { piece }, retries: 0, priority: 1 });
    
    const currentPlayer = playersState.find(p => p.user_id === userId);
    if (!currentPlayer) {
        toast.error("Jogador atual não encontrado.");
        setCurrentAction(null);
        return false;
    }
    
    const standardPiece = standardizePieceFormat(piece);
    const validation = validateMove(standardPiece, gameState.board_state);
    if (!validation.isValid || !validation.side) {
        toast.error(validation.error || "Jogada inválida.");
        setCurrentAction(null);
        return false;
    }
    
    // Atualização Otimista
    const newBoardState = calculateNewBoardState(gameState.board_state, standardPiece, validation.side);
    const newPlayerHand = removePieceFromHand(currentPlayer.hand, standardPiece);
    const nextPlayerUserId = getNextPlayerId(gameState.current_player_turn, playersState);

    // Aplica estado localmente
    setGameState(prev => ({ ...prev, board_state: newBoardState, current_player_turn: nextPlayerUserId, consecutive_passes: 0 }));
    setPlayersState(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, hand: newPlayerHand } : p));
    
    try {
        const gameUpdateResult = await executeGameOperation(
            gameState.id,
            (serverGame) => Promise.resolve({
                board_state: newBoardState,
                current_player_turn: nextPlayerUserId,
                consecutive_passes: 0
            })
        );

        const playerUpdateResult = await executePlayerOperation(
            currentPlayer.id,
            (serverPlayer) => Promise.resolve({ hand: newPlayerHand })
        );

        if (!gameUpdateResult.success || !playerUpdateResult.success) {
            toast.error("Conflito de sincronização. A reconciliação será iniciada.");
            setSyncStatus('conflict');
            gameMetrics.recordGameError('Play Piece Conflict', new Error(gameUpdateResult.error || playerUpdateResult.error), performance.now() - startTime);
            return false;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Play Piece', performance.now() - startTime);
        setSyncStatus('synced');
        toast.success("Jogada sincronizada!");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Play Piece', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao sincronizar jogada: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, userId, executeGameOperation, executePlayerOperation, gameMetrics, persistentQueue]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      toast.warning('Aguarde, processando jogada anterior ou não é sua vez.');
      return false;
    }

    setCurrentAction('passing');
    setSyncStatus('pending');
    gameMetrics.recordGameAction('passTurn_start');
    const startTime = performance.now();
    
    persistentQueue.addItem({ type: 'pass_turn', data: {}, retries: 0, priority: 1 });
    
    // Atualização Otimista
    const nextPlayerUserId = getNextPlayerId(gameState.current_player_turn, playersState);
    const newConsecutivePasses = (gameState.consecutive_passes || 0) + 1;
    
    setGameState(prev => ({...prev, current_player_turn: nextPlayerUserId, consecutive_passes: newConsecutivePasses }));
    
    try {
        const result = await executeGameOperation(
            gameState.id,
            (serverGame) => Promise.resolve({
                current_player_turn: nextPlayerUserId,
                consecutive_passes: (serverGame.consecutive_passes || 0) + 1
            })
        );

        if (!result.success) {
            toast.error("Conflito ao passar o turno.");
            setSyncStatus('conflict');
            gameMetrics.recordGameError('Pass Turn Conflict', new Error(result.error), performance.now() - startTime);
            return false;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Pass Turn', performance.now() - startTime);
        setSyncStatus('synced');
        toast.info("Você passou a vez.");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Pass Turn', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao passar a vez: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, executeGameOperation, gameMetrics, persistentQueue]);

  // Auto play (mantido do código original)
  const playAutomatic = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    const startTime = performance.now();
    
    try {
      const { data, error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) throw error;
      
      gameMetrics.recordGameSuccess('Auto Play', performance.now() - startTime);
      toast.success('Jogada automática realizada!');
      return true;
    } catch (error: any) {
      console.error('❌ Erro no auto play:', error);
      gameMetrics.recordGameError('Auto Play', error, performance.now() - startTime);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, gameState.id, gameMetrics]);

  // Sincronização manual forçada (Removido por enquanto para simplificar, pode ser readicionado se necessário)
  const forceSync = useCallback(async () => {
    console.warn('Force Sync não implementado nesta versão.');
    toast.info('Recurso de Sincronização Forçada em desenvolvimento.');
  }, []);

  // Funções de utilidade
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

  // Sincronizar estados iniciais quando props mudam
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  // Auto-limpeza da fila persistente
  useEffect(() => {
    const interval = setInterval(() => {
      persistentQueue.cleanupExpired();
    }, 60000);

    return () => clearInterval(interval);
  }, [persistentQueue]);

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
    
    // Métricas
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
