
import { useEffect, useCallback } from 'react';
import { useCircuitBreaker } from './useCircuitBreaker';
import { useHealthMonitoring } from './useHealthMonitoring';
import { useFallbackQueue } from './useFallbackQueue';
import { useRobustOperations } from './useRobustOperations';

export const useCommunicationRobustness = (gameId: string) => {
  const { isOpen, shouldAllowRequest, recordSuccess, recordFailure } = useCircuitBreaker();
  const { healthMetrics, updateHealthMetrics, getSystemHealth } = useHealthMonitoring();
  const { addToFallbackQueue, processFallbackQueue, getFallbackQueueSize } = useFallbackQueue();

  const handleSuccess = useCallback((responseTime: number) => {
    updateHealthMetrics(true, responseTime);
    recordSuccess(responseTime);
  }, [updateHealthMetrics, recordSuccess]);

  const handleFailure = useCallback((responseTime: number, error: any) => {
    updateHealthMetrics(false, responseTime);
    recordFailure(responseTime, error);
  }, [updateHealthMetrics, recordFailure]);

  const { robustPlayMove, robustPassTurn } = useRobustOperations({
    gameId,
    shouldAllowRequest,
    recordSuccess: handleSuccess,
    recordFailure: handleFailure,
    addToFallbackQueue
  });

  const handleProcessFallbackQueue = useCallback(async () => {
    await processFallbackQueue({
      play_move: robustPlayMove,
      pass_turn: robustPassTurn
    });
  }, [processFallbackQueue, robustPlayMove, robustPassTurn]);

  // Auto-processar fila de fallback quando circuit breaker fechar
  useEffect(() => {
    if (!isOpen && getFallbackQueueSize() > 0) {
      const timer = setTimeout(handleProcessFallbackQueue, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, getFallbackQueueSize, handleProcessFallbackQueue]);

  const getEnhancedSystemHealth = useCallback(() => {
    const health = getSystemHealth();
    return {
      ...health,
      circuitBreakerStatus: (isOpen ? 'open' : 'closed') as 'open' | 'closed',
      pendingFallbacks: getFallbackQueueSize()
    };
  }, [getSystemHealth, isOpen, getFallbackQueueSize]);

  return {
    robustPlayMove,
    robustPassTurn,
    processFallbackQueue: handleProcessFallbackQueue,
    getSystemHealth: getEnhancedSystemHealth,
    isCircuitOpen: isOpen,
    healthMetrics
  };
};
