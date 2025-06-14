
import { useRef, useCallback } from 'react';

interface FallbackItem {
  action: string;
  data: any;
  timestamp: number;
}

export const useFallbackQueue = () => {
  const fallbackQueueRef = useRef<FallbackItem[]>([]);

  const addToFallbackQueue = useCallback((action: string, data: any) => {
    fallbackQueueRef.current.push({
      action,
      data,
      timestamp: Date.now()
    });
  }, []);

  const processFallbackQueue = useCallback(async (
    handlers: {
      play_move?: (data: any) => Promise<any>;
      pass_turn?: () => Promise<any>;
    }
  ) => {
    if (fallbackQueueRef.current.length === 0) return;

    console.log(`🔄 Processando ${fallbackQueueRef.current.length} ações em fallback`);
    
    const queue = [...fallbackQueueRef.current];
    fallbackQueueRef.current = [];

    for (const item of queue) {
      try {
        if (item.action === 'play_move' && item.data.piece && handlers.play_move) {
          await handlers.play_move(item.data.piece);
        } else if (item.action === 'pass_turn' && handlers.pass_turn) {
          await handlers.pass_turn();
        }
      } catch (error) {
        console.error(`Erro ao processar fallback ${item.action}:`, error);
        // Recolocar na fila se não for muito antigo (5 minutos)
        if (Date.now() - item.timestamp < 300000) {
          fallbackQueueRef.current.push(item);
        }
      }
    }
  }, []);

  const getFallbackQueueSize = useCallback(() => {
    return fallbackQueueRef.current.length;
  }, []);

  return {
    addToFallbackQueue,
    processFallbackQueue,
    getFallbackQueueSize
  };
};
