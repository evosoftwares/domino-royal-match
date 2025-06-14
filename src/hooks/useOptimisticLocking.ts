
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OptimisticLockResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  conflictData?: T;
}

export const useOptimisticLocking = () => {
  const lockTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Executa uma operação com lock otimista
   */
  const executeWithLock = useCallback(async <T>(
    tableName: string,
    recordId: string,
    operation: (currentData: T) => Promise<Partial<T>>,
    maxRetries: number = 3
  ): Promise<OptimisticLockResult<T>> => {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔒 Lock attempt ${attempt}/${maxRetries} for ${tableName}:${recordId}`);

        // 1. Ler estado atual com timestamp
        const { data: currentData, error: readError } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', recordId)
          .single();

        if (readError || !currentData) {
          return {
            success: false,
            error: `Failed to read current state: ${readError?.message}`
          };
        }

        // 2. Executar operação com estado atual
        const updates = await operation(currentData as T);

        // 3. Tentar atualizar com verificação de versão/timestamp
        const updateData = {
          ...updates,
          updated_at: new Date().toISOString()
        };

        const { data: updatedData, error: updateError } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', recordId)
          .eq('updated_at', currentData.updated_at) // Verificação otimista
          .select()
          .single();

        if (updateError) {
          // Se erro indica conflito de concorrência, retry
          if (updateError.message.includes('updated_at') || 
              updateError.code === 'PGRST116') { // No rows updated
            
            console.warn(`⚠️ Optimistic lock conflict on attempt ${attempt}, retrying...`);
            
            // Espera progressiva antes do retry
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          return {
            success: false,
            error: updateError.message
          };
        }

        console.log(`✅ Optimistic lock succeeded on attempt ${attempt}`);
        
        return {
          success: true,
          data: updatedData as T
        };

      } catch (error: any) {
        console.error(`❌ Lock attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error.message || 'Max retries exceeded'
          };
        }

        // Espera antes do próximo retry
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: 'Unexpected error in optimistic locking'
    };
  }, []);

  /**
   * Lock específico para operações de jogo
   */
  const executeGameOperation = useCallback(async (
    gameId: string,
    operation: (gameData: any) => Promise<any>
  ) => {
    return executeWithLock('games', gameId, operation);
  }, [executeWithLock]);

  /**
   * Lock específico para operações de jogador
   */
  const executePlayerOperation = useCallback(async (
    playerId: string,
    operation: (playerData: any) => Promise<any>
  ) => {
    return executeWithLock('game_players', playerId, operation);
  }, [executeWithLock]);

  /**
   * Limpa timeouts pendentes
   */
  const cleanup = useCallback(() => {
    lockTimeouts.current.forEach(timeout => clearTimeout(timeout));
    lockTimeouts.current.clear();
  }, []);

  return {
    executeWithLock,
    executeGameOperation,
    executePlayerOperation,
    cleanup
  };
};
