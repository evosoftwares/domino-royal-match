
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DominoPieceType } from '@/types/game';

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

interface CommunicationHealth {
  serverResponseTime: number;
  successRate: number;
  lastSuccessfulCall: number;
  totalCalls: number;
  failedCalls: number;
}

export const useCommunicationRobustness = (gameId: string) => {
  const [circuitState, setCircuitState] = useState<CircuitBreakerState>({
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  });

  const [healthMetrics, setHealthMetrics] = useState<CommunicationHealth>({
    serverResponseTime: 0,
    successRate: 100,
    lastSuccessfulCall: Date.now(),
    totalCalls: 0,
    failedCalls: 0
  });

  const responseTimesRef = useRef<number[]>([]);
  const fallbackQueueRef = useRef<Array<{ action: string; data: any; timestamp: number }>>([]);

  // Circuit breaker configuration
  const FAILURE_THRESHOLD = 3;
  const TIMEOUT_DURATION = 30000; // 30 seconds
  const HALF_OPEN_RETRY_TIMEOUT = 10000; // 10 seconds

  const updateHealthMetrics = useCallback((success: boolean, responseTime: number) => {
    setHealthMetrics(prev => {
      const newTotalCalls = prev.totalCalls + 1;
      const newFailedCalls = success ? prev.failedCalls : prev.failedCalls + 1;
      
      // Manter apenas os últimos 20 tempos de resposta
      responseTimesRef.current.push(responseTime);
      if (responseTimesRef.current.length > 20) {
        responseTimesRef.current = responseTimesRef.current.slice(-20);
      }

      const avgResponseTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;

      return {
        serverResponseTime: avgResponseTime,
        successRate: ((newTotalCalls - newFailedCalls) / newTotalCalls) * 100,
        lastSuccessfulCall: success ? Date.now() : prev.lastSuccessfulCall,
        totalCalls: newTotalCalls,
        failedCalls: newFailedCalls
      };
    });
  }, []);

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
    updateHealthMetrics(true, responseTime);
    
    if (circuitState.isOpen) {
      console.log('✅ Circuit breaker: Fechando após sucesso');
      setCircuitState({
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0
      });
    }
  }, [circuitState.isOpen, updateHealthMetrics]);

  const recordFailure = useCallback((responseTime: number, error: any) => {
    updateHealthMetrics(false, responseTime);
    
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

  const executeWithCircuitBreaker = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackData?: any
  ): Promise<T | null> => {
    if (!shouldAllowRequest()) {
      console.log(`⛔ ${operationName} bloqueado pelo circuit breaker`);
      
      // Adicionar à fila de fallback se fornecido
      if (fallbackData) {
        fallbackQueueRef.current.push({
          action: operationName,
          data: fallbackData,
          timestamp: Date.now()
        });
      }
      
      return null;
    }

    const startTime = performance.now();

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT_DURATION)
        )
      ]);

      const responseTime = performance.now() - startTime;
      recordSuccess(responseTime);
      
      console.log(`✅ ${operationName} executado com sucesso em ${responseTime.toFixed(2)}ms`);
      return result;

    } catch (error) {
      const responseTime = performance.now() - startTime;
      recordFailure(responseTime, error);
      
      console.error(`❌ ${operationName} falhou:`, error);
      
      // Adicionar à fila de fallback
      if (fallbackData) {
        fallbackQueueRef.current.push({
          action: operationName,
          data: fallbackData,
          timestamp: Date.now()
        });
      }
      
      throw error;
    }
  }, [shouldAllowRequest, recordSuccess, recordFailure]);

  const robustPlayMove = useCallback(async (piece: DominoPieceType) => {
    return executeWithCircuitBreaker(
      async () => {
        const { data, error } = await supabase.rpc('play_move', {
          p_game_id: gameId,
          p_piece: piece.originalFormat || { l: piece.top, r: piece.bottom },
          p_side: 'left' // Será validado no servidor
        });
        
        if (error) throw error;
        return data;
      },
      'play_move',
      { type: 'play', piece }
    );
  }, [gameId, executeWithCircuitBreaker]);

  const robustPassTurn = useCallback(async () => {
    return executeWithCircuitBreaker(
      async () => {
        const { data, error } = await supabase.rpc('pass_turn', { p_game_id: gameId });
        if (error) throw error;
        return data;
      },
      'pass_turn',
      { type: 'pass' }
    );
  }, [gameId, executeWithCircuitBreaker]);

  const processFallbackQueue = useCallback(async () => {
    if (fallbackQueueRef.current.length === 0 || circuitState.isOpen) return;

    console.log(`🔄 Processando ${fallbackQueueRef.current.length} ações em fallback`);
    
    const queue = [...fallbackQueueRef.current];
    fallbackQueueRef.current = [];

    for (const item of queue) {
      try {
        if (item.action === 'play_move' && item.data.piece) {
          await robustPlayMove(item.data.piece);
        } else if (item.action === 'pass_turn') {
          await robustPassTurn();
        }
      } catch (error) {
        console.error(`Erro ao processar fallback ${item.action}:`, error);
        // Recolocar na fila se não for muito antigo (5 minutos)
        if (Date.now() - item.timestamp < 300000) {
          fallbackQueueRef.current.push(item);
        }
      }
    }
  }, [circuitState.isOpen, robustPlayMove, robustPassTurn]);

  // Auto-processar fila de fallback quando circuit breaker fechar
  useEffect(() => {
    if (!circuitState.isOpen && fallbackQueueRef.current.length > 0) {
      const timer = setTimeout(processFallbackQueue, 1000);
      return () => clearTimeout(timer);
    }
  }, [circuitState.isOpen, processFallbackQueue]);

  const getSystemHealth = useCallback(() => {
    const timeSinceLastSuccess = Date.now() - healthMetrics.lastSuccessfulCall;
    const isHealthy = healthMetrics.successRate > 80 && timeSinceLastSuccess < 60000;

    return {
      ...healthMetrics,
      isHealthy,
      timeSinceLastSuccess,
      circuitBreakerStatus: (circuitState.isOpen ? 'open' : 'closed') as 'open' | 'closed',
      pendingFallbacks: fallbackQueueRef.current.length
    };
  }, [healthMetrics, circuitState, fallbackQueueRef.current.length]);

  return {
    robustPlayMove,
    robustPassTurn,
    processFallbackQueue,
    getSystemHealth,
    isCircuitOpen: circuitState.isOpen,
    healthMetrics
  };
};
