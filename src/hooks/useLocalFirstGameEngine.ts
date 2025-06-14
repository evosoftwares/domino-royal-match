import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { standardizePieceFormat, validateMove, toBackendFormat } from '@/utils/standardPieceValidation';
import { useOptimizedStateControl } from './useOptimizedStateControl';

interface UseLocalFirstGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;
type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';

interface PendingOperation {
  id: string;
  type: 'play_move' | 'pass_turn';
  data?: any;
  timestamp: number;
  retries: number;
  priority: number;
}

interface ConflictResolution {
  conflictType: 'state_mismatch' | 'turn_order' | 'piece_removed';
  localState: any;
  serverState: any;
  resolution: 'prefer_local' | 'prefer_server' | 'merge' | 'rollback';
}

export const useLocalFirstGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseLocalFirstGameEngineProps) => {
  // Estados locais
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  
  // Controle de estado otimizado
  const { validateStateUpdate, createStateVersion, shouldApplyUpdate } = useOptimizedStateControl();
  
  // Refs para controle
  const syncQueueRef = useRef<PendingOperation[]>([]);
  const lastSyncAttemptRef = useRef<number>(0);
  const conflictCountRef = useRef<number>(0);

  // Valores computados
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  const isProcessingMove = useMemo(() => currentAction !== null || pendingOperations.length > 0, [currentAction, pendingOperations.length]);

  // LOCAL STATE OPERATIONS - Sempre executam primeiro
  const applyLocalMove = useCallback((piece: DominoPieceType): boolean => {
    try {
      const standardPiece = standardizePieceFormat(piece);
      const validation = validateMove(standardPiece, gameState.board_state);
      
      if (!validation.isValid) {
        console.error('❌ Movimento inválido:', validation.error);
        return false;
      }

      // Atualizar estado local do jogo (sem _version)
      setGameState(prev => ({
        ...prev,
        board_state: {
          ...prev.board_state,
          pieces: [...(prev.board_state?.pieces || []), { piece: standardPiece }]
        },
        current_player_turn: getNextPlayerId(),
        updated_at: new Date().toISOString()
      }));

      // Remover peça da mão do jogador
      setPlayersState(prev => 
        prev.map(player => {
          if (player.user_id === userId) {
            const newHand = player.hand.filter((p: any) => {
              const standardP = standardizePieceFormat(p);
              return !(standardP.top === standardPiece.top && standardP.bottom === standardPiece.bottom);
            });
            return { ...player, hand: newHand };
          }
          return player;
        })
      );

      console.log('✅ Movimento aplicado localmente:', standardPiece);
      return true;
    } catch (error) {
      console.error('❌ Erro ao aplicar movimento local:', error);
      return false;
    }
  }, [gameState.board_state, userId]);

  const applyLocalPass = useCallback((): boolean => {
    try {
      setGameState(prev => ({
        ...prev,
        current_player_turn: getNextPlayerId(),
        updated_at: new Date().toISOString()
      }));

      console.log('✅ Passe aplicado localmente');
      return true;
    } catch (error) {
      console.error('❌ Erro ao aplicar passe local:', error);
      return false;
    }
  }, []);

  // HELPER FUNCTIONS
  const getNextPlayerId = useCallback(() => {
    const currentPlayerIndex = playersState.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playersState.length;
    return playersState[nextPlayerIndex]?.user_id || null;
  }, [playersState, gameState.current_player_turn]);

  const generateOperationId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // QUEUE MANAGEMENT
  const addPendingOperation = useCallback((operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>) => {
    const pendingOp: PendingOperation = {
      id: generateOperationId(),
      timestamp: Date.now(),
      retries: 0,
      ...operation
    };

    setPendingOperations(prev => {
      const newOps = [...prev, pendingOp].sort((a, b) => a.priority - b.priority);
      syncQueueRef.current = newOps;
      return newOps;
    });

    setSyncStatus('pending');
    console.log('📋 Operação adicionada à fila:', pendingOp);
  }, [generateOperationId]);

  const removePendingOperation = useCallback((operationId: string) => {
    setPendingOperations(prev => {
      const filtered = prev.filter(op => op.id !== operationId);
      syncQueueRef.current = filtered;
      
      if (filtered.length === 0) {
        setSyncStatus('synced');
      }
      
      return filtered;
    });
  }, []);

  // SERVER SYNC OPERATIONS
  const syncPlayMoveToServer = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    try {
      const pieceForRPC = piece.originalFormat || toBackendFormat({
        top: piece.top,
        bottom: piece.bottom
      });

      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceForRPC,
        p_side: 'left'
      });

      if (error) throw error;
      
      console.log('✅ Movimento sincronizado com servidor');
      return true;
    } catch (error) {
      console.error('❌ Erro ao sincronizar movimento:', error);
      return false;
    }
  }, [gameState.id]);

  const syncPassToServer = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('pass_turn', {
        p_game_id: gameState.id
      });

      if (error) throw error;
      
      console.log('✅ Passe sincronizado com servidor');
      return true;
    } catch (error) {
      console.error('❌ Erro ao sincronizar passe:', error);
      return false;
    }
  }, [gameState.id]);

  // CONFLICT RESOLUTION
  const resolveConflict = useCallback((conflict: ConflictResolution): boolean => {
    console.warn('🔄 Resolvendo conflito:', conflict.conflictType);
    
    switch (conflict.resolution) {
      case 'prefer_server':
        setGameState(conflict.serverState);
        console.log('📥 Estado do servidor aplicado');
        return true;
        
      case 'prefer_local':
        console.log('📤 Mantendo estado local');
        return true;
        
      case 'rollback':
        // Implementar rollback para estado anterior
        console.log('⏪ Fazendo rollback do estado');
        return false;
        
      default:
        return false;
    }
  }, []);

  // SYNC PROCESSOR
  const processPendingOperations = useCallback(async () => {
    if (syncQueueRef.current.length === 0) return;
    
    const now = Date.now();
    if (now - lastSyncAttemptRef.current < 1000) return; // Throttle
    
    lastSyncAttemptRef.current = now;
    const operationsToProcess = [...syncQueueRef.current].slice(0, 3); // Process max 3 at once
    
    console.log(`🔄 Processando ${operationsToProcess.length} operações pendentes`);
    
    for (const operation of operationsToProcess) {
      try {
        let success = false;
        
        if (operation.type === 'play_move' && operation.data?.piece) {
          success = await syncPlayMoveToServer(operation.data.piece);
        } else if (operation.type === 'pass_turn') {
          success = await syncPassToServer();
        }
        
        if (success) {
          removePendingOperation(operation.id);
          conflictCountRef.current = 0;
        } else {
          // Retry logic
          setPendingOperations(prev => 
            prev.map(op => 
              op.id === operation.id 
                ? { ...op, retries: op.retries + 1 }
                : op
            )
          );
          
          if (operation.retries >= 3) {
            console.error('❌ Operação falhou após 3 tentativas:', operation);
            removePendingOperation(operation.id);
            setSyncStatus('failed');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao processar operação:', error);
      }
    }
  }, [syncPlayMoveToServer, syncPassToServer, removePendingOperation]);

  // AUTO SYNC PROCESSOR
  useEffect(() => {
    const interval = setInterval(() => {
      if (syncQueueRef.current.length > 0) {
        processPendingOperations();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [processPendingOperations]);

  // REALTIME SYNC COM CONFLICT DETECTION
  useEffect(() => {
    const gameChannel = supabase
      .channel(`local-first-game:${gameState.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameState.id}`
      }, (payload) => {
        const serverState = payload.new as GameData;
        
        if (shouldApplyUpdate(serverState, gameState)) {
          console.log('📥 Aplicando atualização do servidor');
          setGameState(serverState);
          setSyncStatus('synced');
        } else {
          console.warn('⚠️ Conflito detectado, resolvendo...');
          const conflict: ConflictResolution = {
            conflictType: 'state_mismatch',
            localState: gameState,
            serverState,
            resolution: conflictCountRef.current > 2 ? 'prefer_server' : 'prefer_local'
          };
          
          resolveConflict(conflict);
          conflictCountRef.current++;
          setSyncStatus('conflict');
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameState.id}`
      }, (payload) => {
        const updatedPlayer = payload.new as PlayerData;
        setPlayersState(prev => 
          prev.map(player => 
            player.user_id === updatedPlayer.user_id ? updatedPlayer : player
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameState.id, gameState, shouldApplyUpdate, resolveConflict]);

  // PUBLIC API - LOCAL FIRST ACTIONS
  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (isProcessingMove || !isMyTurn) {
      toast.error('Não é sua vez ou já está processando uma ação');
      return false;
    }

    setCurrentAction('playing');

    try {
      // 1. APLICAR LOCAL PRIMEIRO
      const localSuccess = applyLocalMove(piece);
      if (!localSuccess) {
        toast.error('Jogada inválida');
        return false;
      }

      // 2. ADICIONAR À FILA DE SYNC
      addPendingOperation({
        type: 'play_move',
        data: { piece },
        priority: 1
      });

      toast.success('Peça jogada! (sincronizando...)');
      return true;
    } catch (error) {
      console.error('❌ Erro ao jogar peça:', error);
      toast.error('Erro ao jogar peça');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, isMyTurn, applyLocalMove, addPendingOperation]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove || !isMyTurn) {
      toast.error('Não é sua vez ou já está processando uma ação');
      return false;
    }

    setCurrentAction('passing');

    try {
      // 1. APLICAR LOCAL PRIMEIRO
      const localSuccess = applyLocalPass();
      if (!localSuccess) {
        toast.error('Erro ao passar a vez');
        return false;
      }

      // 2. ADICIONAR À FILA DE SYNC
      addPendingOperation({
        type: 'pass_turn',
        priority: 2
      });

      toast.info('Você passou a vez! (sincronizando...)');
      return true;
    } catch (error) {
      console.error('❌ Erro ao passar a vez:', error);
      toast.error('Erro ao passar a vez');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, isMyTurn, applyLocalPass, addPendingOperation]);

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

  // DEBUG & UTILITY FUNCTIONS
  const getStateHealth = useCallback(() => {
    return {
      syncStatus,
      pendingOperations: pendingOperations.length,
      conflictCount: conflictCountRef.current,
      lastSyncAttempt: lastSyncAttemptRef.current,
      isHealthy: syncStatus === 'synced' && conflictCountRef.current < 3
    };
  }, [syncStatus, pendingOperations.length]);

  const forceSync = useCallback(() => {
    console.log('🔧 Forçando sincronização...');
    processPendingOperations();
  }, [processPendingOperations]);

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
    pendingMovesCount: pendingOperations.length,
    
    // Utilities
    getStateHealth,
    forceSync,
    
    // Debug
    debugInfo: {
      pendingOperations,
      conflictCount: conflictCountRef.current,
      lastSyncAttempt: lastSyncAttemptRef.current
    }
  };
};
