
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

  // Computed values com lógica corrigida para verificar se é a vez do jogador
  const isMyTurn = useMemo(() => {
    const currentTurn = gameState.current_player_turn;
    const isMyTurnResult = currentTurn === userId;
    
    // Log detalhado para debug
    console.log('🎯 Verificando se é minha vez:', {
      currentTurn,
      userId,
      isMyTurn: isMyTurnResult,
      gameStatus: gameState.status
    });

    // Verificar se o jogador existe na lista
    const playerExists = playersState.find(p => p.user_id === userId);
    if (!playerExists) {
      console.warn('⚠️ Jogador atual não encontrado na lista de jogadores');
    }

    // Verificar se o jogador da vez existe
    const currentPlayerExists = playersState.find(p => p.user_id === currentTurn);
    if (!currentPlayerExists && currentTurn) {
      console.warn('⚠️ Jogador da vez não encontrado na lista:', currentTurn);
    }

    return isMyTurnResult;
  }, [gameState.current_player_turn, userId, playersState, gameState.status]);
  
  // Sincronização realtime simplificada
  useRealtimeSync({
    gameId: gameState.id,
    userId,
    onGameUpdate: (updatedGame) => {
      console.log('📥 Atualização do jogo recebida via realtime:', {
        gameId: updatedGame.id,
        currentPlayerTurn: updatedGame.current_player_turn,
        status: updatedGame.status
      });
      setGameState(updatedGame);
    },
    onPlayerUpdate: (updatedPlayer) => {
      console.log('📥 Atualização de jogador recebida via realtime:', {
        playerId: updatedPlayer.id,
        userId: updatedPlayer.user_id
      });
      setPlayersState(prev => prev.map(p => 
        p.id === updatedPlayer.id ? updatedPlayer : p
      ));
    },
    onConnectionStatusChange: (status) => {
      setSyncStatus(status === 'connected' ? 'synced' : 'failed');
    }
  });

  // Mocks simplificados para compatibilidade
  const mockPersistentQueue = {
    items: [],
    addItem: () => 'mock-id',
    removeItem: () => {},
    updateItem: () => {},
    getNextItem: () => null,
    clearQueue: () => {},
    cleanupExpired: () => {},
    size: 0,
    getStats: () => ({ 
      total: 0,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<number, number>,
      oldestItem: 0,
      retryCount: 0
    })
  };

  const mockGameMetrics = {
    recordGameAction: (action: string) => console.log(`Action: ${action}`),
    recordGameSuccess: (operation: string, responseTime?: number) => console.log(`Success: ${operation}`),
    recordGameError: (operation: string, error: any, responseTime?: number) => console.error(`Error: ${operation}`, error),
    getHealthStatus: () => ({ 
      status: 'healthy' as const,
      metrics: {
        successRate: 100,
        averageResponseTime: 150,
        errorRate: 0,
        lastSuccessTime: Date.now(),
        lastErrorTime: 0,
        memoryUsage: 50,
        cpuTime: 100,
        networkLatency: 50,
        uptime: Date.now(),
        lastHealthCheck: Date.now()
      },
      alerts: {
        critical: [],
        warnings: [],
        info: [],
        highMemoryUsage: false,
        highErrorRate: false,
        networkIssues: false,
        performanceDegradation: false
      },
      recommendations: []
    })
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
  
  // Função de sincronização forçada melhorada
  const forceSync = useCallback(async () => {
    try {
      console.log('🔄 Iniciando sincronização forçada...');
      setSyncStatus('pending');
      
      const [gameResult, playersResult] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameState.id).single(),
        supabase.from('game_players').select(`
          id, user_id, game_id, position, hand, 
          profiles(full_name, avatar_url)
        `).eq('game_id', gameState.id).order('position')
      ]);

      if (gameResult.data) {
        console.log('📥 Dados do jogo sincronizados:', gameResult.data);
        setGameState(gameResult.data);
      }
      
      if (playersResult.data) {
        console.log('📥 Dados dos jogadores sincronizados:', playersResult.data.length, 'jogadores');
        setPlayersState(playersResult.data);
      }
      
      setSyncStatus('synced');
      console.log('✅ Sincronização forçada concluída com sucesso');
    } catch (error) {
      console.error('❌ Erro ao sincronizar:', error);
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
    
    // Debug melhorado
    debugInfo: {
      syncStatus,
      isProcessingMove,
      currentAction,
      isMyTurn,
      currentPlayerTurn: gameState.current_player_turn,
      userId,
      playersCount: playersState.length
    }
  };
};
