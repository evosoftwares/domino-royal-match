
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameData } from '@/types/game';

interface UseOfflinePlayerMonitorProps {
  gameState: GameData;
  isActive?: boolean;
}

export const useOfflinePlayerMonitor = ({ 
  gameState, 
  isActive = true 
}: UseOfflinePlayerMonitorProps) => {
  const lastCheckRef = useRef<number>(0);

  const checkOfflinePlayer = useCallback(async () => {
    if (!isActive || gameState.status !== 'active' || !gameState.current_player_turn) {
      return;
    }

    const now = Date.now();
    
    // Evitar verificações muito frequentes
    if (now - lastCheckRef.current < 10000) { // 10 segundos mínimo
      return;
    }

    lastCheckRef.current = now;

    try {
      // Verificar se o jogador atual está online
      const { data: presence } = await supabase
        .from('player_presence')
        .select('*')
        .eq('user_id', gameState.current_player_turn)
        .single();

      if (!presence) {
        console.log('🔍 Jogador sem registro de presença, considerando offline');
        return;
      }

      const lastSeen = new Date(presence.last_seen);
      const timeSinceLastSeen = now - lastSeen.getTime();
      const isOffline = timeSinceLastSeen > 30000 || presence.status === 'offline'; // 30 segundos

      if (isOffline) {
        const turnStartTime = new Date(gameState.turn_start_time || '');
        const timeSinceTurnStart = now - turnStartTime.getTime();

        // Se passou mais de 12 segundos do turno e jogador está offline
        if (timeSinceTurnStart > 12000) {
          console.log('⏰ Jogador offline detectado, executando jogada automática via trigger');
          
          // Forçar uma atualização no turn_start_time para ativar o trigger
          await supabase
            .from('games')
            .update({ 
              turn_start_time: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', gameState.id);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar jogador offline:', error);
    }
  }, [gameState, isActive]);

  // Verificar periodicamente se há jogadores offline
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(checkOfflinePlayer, 8000); // Verificar a cada 8 segundos

    return () => clearInterval(interval);
  }, [checkOfflinePlayer, isActive]);

  return {
    checkOfflinePlayer
  };
};
