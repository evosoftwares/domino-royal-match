
import { useState, useCallback } from 'react';

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export const useCircuitBreaker = () => {
  const [circuitState, setCircuitState] = useState<CircuitBreakerState>({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  });

  // Circuit breaker configuration
  const FAILURE_THRESHOLD = 3;
  const HALF_OPEN_RETRY_TIMEOUT = 10000; // 10 seconds

  const shouldAllowRequest = useCallback((): boolean => {
    const now = Date.now();

    // Circuit closed - allow requests
    if (!circuitState.isOpen) return true;

    // Circuit open - check if we can try again
    if (now >= circuitState.nextAttemptTime) {
      console.log('🔄 Circuit breaker: Tentando half-open state');
      return true;
    }

    console.log('⛔ Circuit breaker: Bloqueando requisição');
    return false;
  }, [circuitState]);

  const recordSuccess = useCallback((responseTime: number) => {
    if (circuitState.isOpen) {
      console.log('✅ Circuit breaker: Fechando após sucesso');
      setCircuitState({
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      });
    }
  }, [circuitState.isOpen]);

  const recordFailure = useCallback((responseTime: number, error: any) => {
    const now = Date.now();
    const newFailureCount = circuitState.failureCount + 1;

    console.warn(`⚠️ Falha de comunicação ${newFailureCount}/${FAILURE_THRESHOLD}:`, error);

    if (newFailureCount >= FAILURE_THRESHOLD) {
      console.error('💥 Circuit breaker: Abrindo devido a muitas falhas');
      setCircuitState({
        isOpen: true,
        failureCount: newFailureCount,
        lastFailureTime: now,
        nextAttemptTime: now + HALF_OPEN_RETRY_TIMEOUT
      });
    } else {
      setCircuitState(prev => ({
        ...prev,
        failureCount: newFailureCount,
        lastFailureTime: now
      }));
    }
  }, [circuitState.failureCount]);

  return {
    isOpen: circuitState.isOpen,
    shouldAllowRequest,
    recordSuccess,
    recordFailure
  };
};
