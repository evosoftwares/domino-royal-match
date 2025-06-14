
import { useState, useCallback, useEffect, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { useOptimisticGameActions } from './useOptimisticGameActions';
import { useRealtimeSync } from './useRealtimeSync';
import { usePersistentQueue } from './usePersistentQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseLocalFirstGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';
type ActionType = 'playing' | 'passing' | 'auto_playing' | 'syncing' | null;

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

  // Fila persistente para recuperação de operações
  const persistentQueue = usePersistentQueue({
    gameId: gameState.id,
    maxItems: 50,
    maxAge: 600000 // 10 minutos
  });

  // Função para atualizar estado (usada pelo Two-Phase Commit)
  const handleStateUpdate = useCallback((newGameState: GameData, newPlayersState: PlayerData[]) => {
    setGameState(newGameState);
    setPlayersState(newPlayersState);
  }, []);

  // Hook de ações otimistas com circuit breaker
  const {
    playPiece: optimisticPlayPiece,
    passTurn: optimisticPassTurn,
    syncPendingOperations,
    isProcessingMove,
    pendingOperationsCount,
    fallbackQueueSize,
    stats,
    systemStats
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
      
      // Processar operações pendentes quando servidor responder
      if (fallbackQueueSize > 0) {
        console.log('🔄 Processando fila de fallback após atualização do servidor');
        syncPendingOperations();
      }
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
      const newSyncStatus: SyncStatus = status === 'connected' ? 'synced' : 'failed';
      setSyncStatus(newSyncStatus);
      
      // Quando conexão voltar, processar operações pendentes
      if (status === 'connected' && fallbackQueueSize > 0) {
        console.log('🔄 Conexão restaurada, processando operações pendentes');
        syncPendingOperations();
      }
    }
  });

  // Valores computados
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);

  // AÇÕES PÚBLICAS - Envolvidas com Two-Phase Commit + Circuit Breaker
  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      return false;
    }

    setCurrentAction('playing');
    setSyncStatus('pending');
    
    // Adicionar à fila persistente como backup
    persistentQueue.addItem({
      type: 'play_move',
      data: { piece },
      retries: 0,
      priority: 1
    });
    
    const result = await optimisticPlayPiece(piece);
    
    // Remover da fila se sucesso
    if (result) {
      // Limpar item da fila persistente
      persistentQueue.cleanupExpired();
    }
    
    setCurrentAction(null);
    setSyncStatus(result ? 'synced' : 'failed');
    
    return result;
  }, [isMyTurn, isProcessingMove, optimisticPlayPiece, persistentQueue]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      return false;
    }

    setCurrentAction('passing');
    setSyncStatus('pending');
    
    // Adicionar à fila persistente como backup
    persistentQueue.addItem({
      type: 'pass_turn',
      data: {},
      retries: 0,
      priority: 1
    });
    
    const result = await optimisticPassTurn();
    
    // Remover da fila se sucesso
    if (result) {
      persistentQueue.cleanupExpired();
    }
    
    setCurrentAction(null);
    setSyncStatus(result ? 'synced' : 'failed');
    
    return result;
  }, [isMyTurn, isProcessingMove, optimisticPassTurn, persistentQueue]);

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

  // Sincronização manual forçada
  const forceSync = useCallback(async () => {
    console.log('🔧 Forçando sincronização...');
    setCurrentAction('syncing');
    
    try {
      await syncPendingOperations();
      toast.success('Sincronização completa');
    } catch (error) {
      console.error('❌ Erro na sincronização forçada:', error);
      toast.error('Erro na sincronização');
    } finally {
      setCurrentAction(null);
    }
  }, [syncPendingOperations]);

  // Funções de utilidade
  const getStateHealth = useCallback(() => {
    const queueStats = persistentQueue.getStats();
    
    return {
      syncStatus,
      pendingOperations: pendingOperationsCount,
      fallbackQueue: fallbackQueueSize,
      persistentQueue: queueStats.total,
      isHealthy: syncStatus === 'synced' && pendingOperationsCount === 0 && fallbackQueueSize === 0,
      lastSyncAttempt: Date.now(),
      stats,
      systemStats
    };
  }, [syncStatus, pendingOperationsCount, fallbackQueueSize, persistentQueue, stats, systemStats]);

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
    }, 60000); // A cada minuto

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
    pendingMovesCount: pendingOperationsCount,
    fallbackQueueSize,
    persistentQueueSize: persistentQueue.size,
    
    // Utilities
    getStateHealth,
    
    // Debug
    debugInfo: {
      pendingOperations: pendingOperationsCount,
      fallbackQueue: fallbackQueueSize,
      persistentQueue: persistentQueue.size,
      conflictCount: 0,
      lastSyncAttempt: Date.now(),
      stats,
      systemStats
    }
  };
};
