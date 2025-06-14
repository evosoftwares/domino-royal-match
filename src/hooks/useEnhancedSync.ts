
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PieceFormatConverter } from '@/utils/pieceFormatConverter';
import { DominoPieceType } from '@/types/game';
import { toast } from 'sonner';

interface SyncResult {
  success: boolean;
  data?: any;
  error?: string;
  requiresReconciliation?: boolean;
}

export const useEnhancedSync = (gameId: string) => {
  const lastSyncTime = useRef<number>(Date.now());
  const syncQueue = useRef<Array<{ action: string; data: any; timestamp: number }>>([]);

  /**
   * Executa jogada com conversão automática de formato e retry
   */
  const syncPlayMove = useCallback(async (piece: DominoPieceType): Promise<SyncResult> => {
    try {
      console.log('🔄 Enhanced sync: play move', piece);

      // Converter para formato do backend automaticamente
      const backendPiece = PieceFormatConverter.toBackend(piece);
      
      // Adicionar à fila de sync para recovery
      syncQueue.current.push({
        action: 'play_move',
        data: { piece: backendPiece },
        timestamp: Date.now()
      });

      const { data, error } = await supabase.functions.invoke('play-move', {
        body: {
          gameId,
          piece: backendPiece
        }
      });

      if (error) {
        console.error('❌ Enhanced sync error:', error);
        return {
          success: false,
          error: error.message,
          requiresReconciliation: true
        };
      }

      // Sucesso - remover da fila
      syncQueue.current = syncQueue.current.filter(
        item => item.timestamp !== syncQueue.current[syncQueue.current.length - 1]?.timestamp
      );

      lastSyncTime.current = Date.now();
      
      console.log('✅ Enhanced sync: move completed', data);
      
      return {
        success: true,
        data
      };

    } catch (error: any) {
      console.error('❌ Enhanced sync network error:', error);
      
      return {
        success: false,
        error: error.message || 'Network error',
        requiresReconciliation: true
      };
    }
  }, [gameId]);

  /**
   * Executa passe de turno com retry
   */
  const syncPassTurn = useCallback(async (): Promise<SyncResult> => {
    try {
      console.log('🔄 Enhanced sync: pass turn');

      // Adicionar à fila de sync
      syncQueue.current.push({
        action: 'pass_turn',
        data: {},
        timestamp: Date.now()
      });

      const { data, error } = await supabase.functions.invoke('pass-turn', {
        body: { gameId }
      });

      if (error) {
        console.error('❌ Enhanced sync pass error:', error);
        return {
          success: false,
          error: error.message,
          requiresReconciliation: true
        };
      }

      // Sucesso - remover da fila
      syncQueue.current = syncQueue.current.filter(
        item => item.timestamp !== syncQueue.current[syncQueue.current.length - 1]?.timestamp
      );

      lastSyncTime.current = Date.now();
      
      console.log('✅ Enhanced sync: pass completed', data);
      
      return {
        success: true,
        data
      };

    } catch (error: any) {
      console.error('❌ Enhanced sync pass network error:', error);
      
      return {
        success: false,
        error: error.message || 'Network error',
        requiresReconciliation: true
      };
    }
  }, [gameId]);

  /**
   * Processa fila de operações pendentes
   */
  const processPendingSync = useCallback(async (): Promise<void> => {
    if (syncQueue.current.length === 0) return;

    console.log(`🔄 Processing ${syncQueue.current.length} pending sync operations`);

    const operations = [...syncQueue.current];
    syncQueue.current = [];

    for (const operation of operations) {
      try {
        if (operation.action === 'play_move') {
          const result = await syncPlayMove(operation.data.piece);
          if (!result.success) {
            // Recolocar na fila se falhou
            syncQueue.current.push(operation);
          }
        } else if (operation.action === 'pass_turn') {
          const result = await syncPassTurn();
          if (!result.success) {
            // Recolocar na fila se falhou
            syncQueue.current.push(operation);
          }
        }

        // Pequena pausa entre operações
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('Error processing pending sync:', error);
        // Recolocar na fila
        syncQueue.current.push(operation);
      }
    }

    if (syncQueue.current.length > 0) {
      toast.warning(`${syncQueue.current.length} operações ainda pendentes`);
    } else {
      toast.success('Todas as operações foram sincronizadas');
    }
  }, [syncPlayMove, syncPassTurn]);

  /**
   * Força sincronização completa
   */
  const forceFullSync = useCallback(async (): Promise<void> => {
    console.log('🔧 Force full sync initiated');
    
    try {
      // Primeiro processar operações pendentes
      await processPendingSync();
      
      // Depois buscar estado atual do servidor
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*, profiles(*)')
        .eq('game_id', gameId);

      if (gameError || playersError) {
        throw new Error('Failed to fetch current game state');
      }

      console.log('✅ Full sync completed', { game: gameData, players: playersData });
      toast.success('Sincronização completa realizada');

    } catch (error: any) {
      console.error('❌ Force full sync failed:', error);
      toast.error('Erro na sincronização completa');
    }
  }, [gameId, processPendingSync]);

  /**
   * Estatísticas de sincronização
   */
  const getSyncStats = useCallback(() => {
    return {
      pendingOperations: syncQueue.current.length,
      lastSyncTime: lastSyncTime.current,
      timeSinceLastSync: Date.now() - lastSyncTime.current,
      oldestPendingOperation: syncQueue.current.length > 0 
        ? Math.min(...syncQueue.current.map(op => op.timestamp))
        : null
    };
  }, []);

  return {
    syncPlayMove,
    syncPassTurn,
    processPendingSync,
    forceFullSync,
    getSyncStats,
    pendingOperationsCount: syncQueue.current.length
  };
};
