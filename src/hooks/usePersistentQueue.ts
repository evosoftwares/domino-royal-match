
import { useState, useCallback, useEffect, useRef } from 'react';

interface QueueItem {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
  priority: number;
  gameId: string;
}

interface UsePersistentQueueProps {
  gameId: string;
  maxItems?: number;
  maxAge?: number; // em milissegundos
}

export const usePersistentQueue = ({ 
  gameId, 
  maxItems = 50, 
  maxAge = 300000 // 5 minutos
}: UsePersistentQueueProps) => {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const storageKey = `game-queue-${gameId}`;
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Carregar fila do localStorage na inicialização
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const items: QueueItem[] = JSON.parse(saved);
        const now = Date.now();
        
        // Filtrar itens expirados
        const validItems = items.filter(item => 
          (now - item.timestamp) < maxAge && item.gameId === gameId
        );
        
        if (validItems.length > 0) {
          setQueueItems(validItems);
          console.log(`📦 Carregados ${validItems.length} itens da fila persistente`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar fila do localStorage:', error);
    }
  }, [gameId, maxAge, storageKey]);

  // Salvar fila no localStorage com debounce
  const saveToStorage = useCallback((items: QueueItem[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (items.length === 0) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(items));
        }
        console.log(`💾 Fila salva: ${items.length} itens`);
      } catch (error) {
        console.error('❌ Erro ao salvar fila:', error);
      }
    }, 500);
  }, [storageKey]);

  // Adicionar item à fila
  const addItem = useCallback((item: Omit<QueueItem, 'id' | 'timestamp' | 'gameId'>) => {
    const newItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      gameId,
      ...item
    };

    setQueueItems(prev => {
      const newItems = [...prev, newItem]
        .sort((a, b) => a.priority - b.priority)
        .slice(0, maxItems); // Limitar tamanho
        
      saveToStorage(newItems);
      return newItems;
    });

    console.log('📋 Item adicionado à fila persistente:', newItem.type);
    return newItem.id;
  }, [gameId, maxItems, saveToStorage]);

  // Remover item da fila
  const removeItem = useCallback((itemId: string) => {
    setQueueItems(prev => {
      const filtered = prev.filter(item => item.id !== itemId);
      saveToStorage(filtered);
      return filtered;
    });
  }, [saveToStorage]);

  // Atualizar item (ex: incrementar retries)
  const updateItem = useCallback((itemId: string, updates: Partial<QueueItem>) => {
    setQueueItems(prev => {
      const updated = prev.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Obter próximo item para processamento
  const getNextItem = useCallback((filterFn?: (item: QueueItem) => boolean): QueueItem | null => {
    const items = filterFn ? queueItems.filter(filterFn) : queueItems;
    return items.length > 0 ? items[0] : null;
  }, [queueItems]);

  // Limpar itens expirados
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    setQueueItems(prev => {
      const valid = prev.filter(item => (now - item.timestamp) < maxAge);
      if (valid.length !== prev.length) {
        saveToStorage(valid);
        console.log(`🧹 Removidos ${prev.length - valid.length} itens expirados`);
      }
      return valid;
    });
  }, [maxAge, saveToStorage]);

  // Limpar tudo
  const clearQueue = useCallback(() => {
    setQueueItems([]);
    localStorage.removeItem(storageKey);
    console.log('🗑️ Fila limpa');
  }, [storageKey]);

  // Estatísticas
  const getStats = useCallback(() => {
    const stats = {
      total: queueItems.length,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<number, number>,
      oldestItem: queueItems.length > 0 ? Math.min(...queueItems.map(i => i.timestamp)) : null,
      retryCount: queueItems.reduce((sum, item) => sum + item.retries, 0)
    };

    queueItems.forEach(item => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
    });

    return stats;
  }, [queueItems]);

  // Cleanup automático
  useEffect(() => {
    const interval = setInterval(cleanupExpired, 60000); // A cada minuto
    return () => clearInterval(interval);
  }, [cleanupExpired]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    items: queueItems,
    addItem,
    removeItem,
    updateItem,
    getNextItem,
    clearQueue,
    cleanupExpired,
    getStats,
    size: queueItems.length
  };
};
