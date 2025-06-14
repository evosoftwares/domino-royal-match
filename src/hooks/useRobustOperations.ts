
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DominoPieceType } from '@/types/game';

interface UseRobustOperationsProps {
  gameId: string;
  shouldAllowRequest: () => boolean;
  recordSuccess: (responseTime: number) => void;
  recordFailure: (responseTime: number, error: any) => void;
  addToFallbackQueue: (action: string, data: any) => void;
}

export const useRobustOperations = ({
  gameId,
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
  addToFallbackQueue
}: UseRobustOperationsProps) => {
  const TIMEOUT_DURATION = 30000; // 30 seconds

  const executeWithCircuitBreaker = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackData?: any
  ): Promise<T | null> => {
    if (!shouldAllowRequest()) {
      console.log(`⛔ ${operationName} bloqueado pelo circuit breaker`);
      
      // Adicionar à fila de fallback se fornecido
      if (fallbackData) {
        addToFallbackQueue(operationName, fallbackData);
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
        addToFallbackQueue(operationName, fallbackData);
      }
      
      throw error;
    }
  }, [shouldAllowRequest, recordSuccess, recordFailure, addToFallbackQueue]);

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

  return {
    robustPlayMove,
    robustPassTurn
  };
};
