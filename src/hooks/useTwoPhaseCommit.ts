
import { useState, useCallback, useRef } from 'react';
import { DominoPieceType, GameData, PlayerData } from '@/types/game';

export interface Operation {
  id: string;
  type: 'play_move' | 'pass_turn';
  data?: any;
  timestamp: number;
  localState: {
    gameState: GameData;
    playersState: PlayerData[];
  };
  status: 'pending' | 'committed' | 'rolled_back';
}

interface UseTwoPhaseCommitProps {
  gameState: GameData;
  playersState: PlayerData[];
  onStateUpdate: (gameState: GameData, playersState: PlayerData[]) => void;
}

export const useTwoPhaseCommit = ({
  gameState,
  playersState,
  onStateUpdate
}: UseTwoPhaseCommitProps) => {
  const [pendingOperations, setPendingOperations] = useState<Operation[]>([]);
  const rollbackTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Gerar ID único para operação
  const generateOperationId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // FASE 1: Aplicar mudança local (Optimistic UI)
  const applyOptimisticUpdate = useCallback((operation: Omit<Operation, 'id' | 'timestamp' | 'status'>) => {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    // Criar snapshot do estado atual para rollback
    const newOperation: Operation = {
      id: operationId,
      timestamp,
      status: 'pending',
      localState: {
        gameState: { ...gameState },
        playersState: [...playersState]
      },
      ...operation
    };

    // Adicionar à lista de operações pendentes
    setPendingOperations(prev => [...prev, newOperation]);

    console.log('🚀 Fase 1: Aplicando update otimista:', {
      operationId,
      type: operation.type,
      timestamp
    });

    // Configurar timeout para rollback automático se servidor não responder
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Timeout atingido, fazendo rollback automático:', operationId);
      rollbackOperation(operationId, 'timeout');
    }, 15000); // 15 segundos

    rollbackTimeoutRef.current.set(operationId, timeoutId);

    return operationId;
  }, [gameState, playersState, generateOperationId]);

  // FASE 2: Confirmar operação (quando servidor aceita)
  const commitOperation = useCallback((operationId: string, serverState?: { gameState: GameData; playersState: PlayerData[] }) => {
    console.log('✅ Fase 2: Confirmando operação:', operationId);

    // Limpar timeout de rollback
    const timeoutId = rollbackTimeoutRef.current.get(operationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      rollbackTimeoutRef.current.delete(operationId);
    }

    // Marcar operação como confirmada
    setPendingOperations(prev => 
      prev.map(op => 
        op.id === operationId 
          ? { ...op, status: 'committed' as const }
          : op
      )
    );

    // Se servidor enviou estado atualizado, aplicar
    if (serverState) {
      console.log('📥 Aplicando estado do servidor');
      onStateUpdate(serverState.gameState, serverState.playersState);
    }

    // Limpar operação confirmada após um tempo
    setTimeout(() => {
      setPendingOperations(prev => prev.filter(op => op.id !== operationId));
    }, 5000);

    return true;
  }, [onStateUpdate]);

  // ROLLBACK: Reverter operação (quando servidor rejeita ou timeout)
  const rollbackOperation = useCallback((operationId: string, reason: 'rejected' | 'timeout' | 'conflict') => {
    console.warn('🔄 Fazendo rollback da operação:', { operationId, reason });

    const operation = pendingOperations.find(op => op.id === operationId);
    if (!operation) {
      console.error('❌ Operação não encontrada para rollback:', operationId);
      return false;
    }

    // Limpar timeout se existir
    const timeoutId = rollbackTimeoutRef.current.get(operationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      rollbackTimeoutRef.current.delete(operationId);
    }

    // Reverter para estado anterior
    console.log('⏪ Revertendo para estado anterior:', operation.localState);
    onStateUpdate(operation.localState.gameState, operation.localState.playersState);

    // Marcar como revertida e remover
    setPendingOperations(prev => 
      prev.filter(op => op.id !== operationId)
    );

    return true;
  }, [pendingOperations, onStateUpdate]);

  // Verificar se operação está pendente
  const isOperationPending = useCallback((operationId: string) => {
    return pendingOperations.some(op => op.id === operationId && op.status === 'pending');
  }, [pendingOperations]);

  // Obter estatísticas
  const getStats = useCallback(() => {
    const pending = pendingOperations.filter(op => op.status === 'pending').length;
    const committed = pendingOperations.filter(op => op.status === 'committed').length;
    const total = pendingOperations.length;

    return {
      pending,
      committed,
      total,
      oldestPending: pending > 0 
        ? Math.min(...pendingOperations
            .filter(op => op.status === 'pending')
            .map(op => Date.now() - op.timestamp))
        : 0
    };
  }, [pendingOperations]);

  // Limpar todas as operações pendentes (emergência)
  const clearAllOperations = useCallback(() => {
    console.warn('🧹 Limpando todas as operações pendentes');
    
    // Limpar todos os timeouts
    rollbackTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    rollbackTimeoutRef.current.clear();
    
    // Limpar operações
    setPendingOperations([]);
  }, []);

  return {
    // Principais funções
    applyOptimisticUpdate,
    commitOperation,
    rollbackOperation,
    
    // Estado
    pendingOperations,
    
    // Utilities
    isOperationPending,
    getStats,
    clearAllOperations,
    
    // Métricas
    hasPendingOperations: pendingOperations.length > 0,
    pendingCount: pendingOperations.filter(op => op.status === 'pending').length
  };
};
