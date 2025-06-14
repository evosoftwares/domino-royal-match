
import { useState, useCallback, useRef, useEffect } from 'react';
import { DominoPieceType } from '@/types/game';

interface PendingMove {
  id: string;
  type: 'play' | 'pass';
  piece?: DominoPieceType;
  timestamp: number;
  retryCount: number;
  priority: number; // 1 = high (play), 2 = medium (pass)
  nextRetryAt: number;
}

interface OptimizedPendingMovesConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  onMoveSuccess: (moveId: string) => void;
  onMoveFailure: (moveId: string, error: any) => void;
}

export const useOptimizedPendingMoves = (config: OptimizedPendingMovesConfig) => {
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<NodeJS.Timeout>();

  const calculateRetryDelay = useCallback((retryCount: number): number => {
    // Exponential backoff: 500ms, 1s, 2s, 4s, 8s (max)
    const delay = Math.min(
      config.baseDelay * Math.pow(2, retryCount),
      config.maxDelay
    );
    return delay;
  }, [config.baseDelay, config.maxDelay]);

  const addPendingMove = useCallback((move: Omit<PendingMove, 'id' | 'timestamp' | 'retryCount' | 'nextRetryAt'>) => {
    const newMove: PendingMove = {
      ...move,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now()
    };

    setPendingMoves(prev => {
      // Remover movimentos muito antigos (mais de 2 minutos)
      const filtered = prev.filter(m => Date.now() - m.timestamp < 120000);
      
      // Adicionar novo movimento e ordenar por prioridade
      const updated = [...filtered, newMove];
      return updated.sort((a, b) => a.priority - b.priority);
    });

    return newMove.id;
  }, []);

  const removePendingMove = useCallback((moveId: string) => {
    setPendingMoves(prev => prev.filter(m => m.id !== moveId));
  }, []);

  const retryPendingMove = useCallback((moveId: string) => {
    setPendingMoves(prev => prev.map(move => {
      if (move.id === moveId) {
        const newRetryCount = move.retryCount + 1;
        if (newRetryCount >= config.maxRetries) {
          config.onMoveFailure(moveId, new Error('Max retries exceeded'));
          return null;
        }
        
        return {
          ...move,
          retryCount: newRetryCount,
          nextRetryAt: Date.now() + calculateRetryDelay(newRetryCount)
        };
      }
      return move;
    }).filter(Boolean) as PendingMove[]);
  }, [config, calculateRetryDelay]);

  const getNextMoveToProcess = useCallback((): PendingMove | null => {
    const now = Date.now();
    const availableMoves = pendingMoves.filter(move => move.nextRetryAt <= now);
    
    if (availableMoves.length === 0) return null;
    
    // Retornar movimento com maior prioridade (menor número = maior prioridade)
    return availableMoves.reduce((highest, current) => 
      current.priority < highest.priority ? current : highest
    );
  }, [pendingMoves]);

  const processNextMove = useCallback(async (syncFunction: (move: PendingMove) => Promise<boolean>) => {
    if (isProcessing) return;

    const nextMove = getNextMoveToProcess();
    if (!nextMove) return;

    setIsProcessing(true);

    try {
      const success = await syncFunction(nextMove);
      
      if (success) {
        removePendingMove(nextMove.id);
        config.onMoveSuccess(nextMove.id);
      } else {
        retryPendingMove(nextMove.id);
      }
    } catch (error) {
      console.error('Erro ao processar movimento:', error);
      retryPendingMove(nextMove.id);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, getNextMoveToProcess, removePendingMove, retryPendingMove, config]);

  // Auto-processing com timing otimizado
  useEffect(() => {
    if (processingRef.current) {
      clearTimeout(processingRef.current);
    }

    if (pendingMoves.length > 0 && !isProcessing) {
      const nextMove = getNextMoveToProcess();
      if (nextMove) {
        processingRef.current = setTimeout(() => {
          // Este processamento precisa ser acionado externamente
          // para ter acesso à função de sincronização
        }, 100);
      } else {
        // Agendar para o próximo movimento disponível
        const nextAvailable = pendingMoves.reduce((earliest, move) => 
          move.nextRetryAt < earliest ? move.nextRetryAt : earliest, 
          Date.now() + 60000
        );
        
        const delay = Math.max(0, nextAvailable - Date.now());
        processingRef.current = setTimeout(() => {
          // Trigger recheck
          setPendingMoves(prev => [...prev]);
        }, delay);
      }
    }

    return () => {
      if (processingRef.current) {
        clearTimeout(processingRef.current);
      }
    };
  }, [pendingMoves, isProcessing, getNextMoveToProcess]);

  return {
    pendingMoves,
    addPendingMove,
    removePendingMove,
    processNextMove,
    isProcessing,
    pendingCount: pendingMoves.length,
    getNextMoveToProcess
  };
};
