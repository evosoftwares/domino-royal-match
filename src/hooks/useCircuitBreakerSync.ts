
import { useCallback, useRef } from 'react';
import { useCircuitBreaker } from './useCircuitBreaker';
import { useFallbackQueue } from './useFallbackQueue';
import { useRobustOperations } from './useRobustOperations';

interface UseCircuitBreakerSyncProps {
  gameId: string;
}

export const useCircuitBreakerSync = ({ gameId }: UseCircuitBreakerSyncProps) => {
  const lastSyncAttempt = useRef<number>(0);
  
  // Circuit breaker para proteção contra falhas
  const {
    shouldAllowRequest,
    recordSuccess,
    recordFailure,
    isOpen
  } = useCircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 segundos
    monitoringWindow: 60000 // 1 minuto
  });

  // Fila de fallback para operações offline
  const {
    addToFallbackQueue,
    processFallbackQueue,
    getFallbackQueueSize
  } = useFallbackQueue();

  // Operações robustas com retry
  const {
    robustPlayMove,
    robustPassTurn
  } = useRobustOperations({
    gameId,
    shouldAllowRequest,
    recordSuccess,
    recordFailure,
    addToFallbackQueue
  });

  // Executar operação com proteção completa
  const executeWithProtection = useCallback(async <T>(
    operation: () => Promise<T>,
    fallbackData?: any
  ): Promise<T | null> => {
    lastSyncAttempt.current = Date.now();
    
    try {
      return await operation();
    } catch (error) {
      console.error('❌ Operação falhou, adicionando ao fallback:', error);
      
      if (fallbackData) {
        addToFallbackQueue(fallbackData.action, fallbackData.data);
      }
      
      return null;
    }
  }, [addToFallbackQueue]);

  // Processar fila de fallback quando conexão voltar
  const processPendingOperations = useCallback(async () => {
    if (getFallbackQueueSize() === 0) return;
    
    console.log('🔄 Processando operações em fallback...');
    
    await processFallbackQueue({
      play_move: robustPlayMove,
      pass_turn: robustPassTurn
    });
  }, [getFallbackQueueSize, processFallbackQueue, robustPlayMove, robustPassTurn]);

  // Obter estatísticas do sistema
  const getSystemStats = useCallback(() => {
    return {
      circuitBreaker: {
        isOpen,
        failures: 0,
        successes: 0,
        lastFailure: null
      },
      fallbackQueue: getFallbackQueueSize(),
      lastSyncAttempt: lastSyncAttempt.current,
      timeSinceLastSync: Date.now() - lastSyncAttempt.current
    };
  }, [isOpen, getFallbackQueueSize]);

  return {
    // Operações principais
    executeWithProtection,
    robustPlayMove,
    robustPassTurn,
    
    // Gerenciamento
    processPendingOperations,
    addToFallbackQueue,
    
    // Estatísticas
    getSystemStats,
    fallbackQueueSize: getFallbackQueueSize()
  };
};
