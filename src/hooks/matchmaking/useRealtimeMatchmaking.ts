
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGameCheck } from '@/hooks/useGameCheck';

interface UseRealtimeMatchmakingProps {
  fetchQueuePlayers: () => Promise<void>;
  mountedRef: React.MutableRefObject<boolean>;
  gameCreationLockRef: React.MutableRefObject<boolean>;
}

export const useRealtimeMatchmaking = ({ 
  fetchQueuePlayers, 
  mountedRef, 
  gameCreationLockRef 
}: UseRealtimeMatchmakingProps) => {
  const { checkUserActiveGame } = useGameCheck();

  useEffect(() => {
    mountedRef.current = true;
    gameCreationLockRef.current = false;
    
    // Verificar jogo ativo antes de buscar fila
    const initializeQueue = async () => {
      const hasActiveGame = await checkUserActiveGame();
      if (!hasActiveGame && mountedRef.current) {
        fetchQueuePlayers();
      }
    };

    initializeQueue();

    // Polling mais frequente para detecção rápida
    const queueInterval = setInterval(() => {
      if (mountedRef.current && !gameCreationLockRef.current) {
        fetchQueuePlayers();
      }
    }, 1500);

    // Realtime para mudanças na fila
    const queueChannel = supabase
      .channel('simple-matchmaking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => {
          if (mountedRef.current && !gameCreationLockRef.current) {
            setTimeout(() => {
              if (mountedRef.current) {
                fetchQueuePlayers();
              }
            }, 200);
          }
        }
      )
      .subscribe();

    // Realtime para mudanças nos jogos (detecção de jogo criado)
    const gamesChannel = supabase
      .channel('games-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async () => {
          console.log('🎮 Novo jogo detectado, verificando...');
          if (mountedRef.current) {
            setTimeout(async () => {
              const hasActiveGame = await checkUserActiveGame();
              if (hasActiveGame) {
                console.log('✅ Redirecionando para jogo ativo');
              }
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      gameCreationLockRef.current = false;
      clearInterval(queueInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gamesChannel);
    };
  }, [fetchQueuePlayers, checkUserActiveGame, mountedRef, gameCreationLockRef]);
};
