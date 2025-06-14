
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
   * Executa operação com lock otimista para tabela games
   */
  const executeGameOperation = useCallback(async <T = any>(
    gameId: string,
    operation: (currentData: T) => Promise<Partial<T>>,
    maxRetries: number = 3
  ): Promise<OptimisticLockResult<T>> => {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔒 Game lock attempt ${attempt}/${maxRetries} for game:${gameId}`);

        // 1. Ler estado atual do jogo
        const { data: currentData, error: readError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (readError || !currentData) {
          return {
            success: false,
            error: `Failed to read game state: ${readError?.message}`
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
          .from('games')
          .update(updateData)
          .eq('id', gameId)
          .eq('updated_at', currentData.updated_at) // Verificação otimista
          .select()
          .single();

        if (updateError) {
          // Se erro indica conflito de concorrência, retry
          if (updateError.code === 'PGRST116') { // No rows updated - conflito
            console.warn(`⚠️ Optimistic lock conflict on game attempt ${attempt}, retrying...`);
            
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

        console.log(`✅ Game optimistic lock succeeded on attempt ${attempt}`);
        
        return {
          success: true,
          data: updatedData as T
        };

      } catch (error: any) {
        console.error(`❌ Game lock attempt ${attempt} failed:`, error);
        
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
      error: 'Unexpected error in game optimistic locking'
    };
  }, []);

  /**
   * Executa operação com lock otimista para tabela game_players
   */
  const executePlayerOperation = useCallback(async <T = any>(
    playerId: string,
    operation: (currentData: T) => Promise<Partial<T>>,
    maxRetries: number = 3
  ): Promise<OptimisticLockResult<T>> => {
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔒 Player lock attempt ${attempt}/${maxRetries} for player:${playerId}`);

        // 1. Ler estado atual do jogador
        const { data: currentData, error: readError } = await supabase
          .from('game_players')
          .select('*')
          .eq('id', playerId)
          .single();

        if (readError || !currentData) {
          return {
            success: false,
            error: `Failed to read player state: ${readError?.message}`
          };
        }

        // 2. Executar operação com estado atual
        const updates = await operation(currentData as T);

        // 3. Tentar atualizar - game_players não tem updated_at, usar joined_at como versão
        const { data: updatedData, error: updateError } = await supabase
          .from('game_players')
          .update(updates)
          .eq('id', playerId)
          .eq('joined_at', currentData.joined_at) // Verificação otimista usando joined_at
          .select()
          .single();

        if (updateError) {
          // Se erro indica conflito de concorrência, retry
          if (updateError.code === 'PGRST116') { // No rows updated - conflito
            console.warn(`⚠️ Optimistic lock conflict on player attempt ${attempt}, retrying...`);
            
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

        console.log(`✅ Player optimistic lock succeeded on attempt ${attempt}`);
        
        return {
          success: true,
          data: updatedData as T
        };

      } catch (error: any) {
        console.error(`❌ Player lock attempt ${attempt} failed:`, error);
        
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
      error: 'Unexpected error in player optimistic locking'
    };
  }, []);

  /**
   * Limpa timeouts pendentes
   */
  const cleanup = useCallback(() => {
    lockTimeouts.current.forEach(timeout => clearTimeout(timeout));
    lockTimeouts.current.clear();
  }, []);

  return {
    executeGameOperation,
    executePlayerOperation,
    cleanup
  };
};
