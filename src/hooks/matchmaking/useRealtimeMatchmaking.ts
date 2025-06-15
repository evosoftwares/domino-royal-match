
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

    // Polling mais frequente para detecção rápida de mudanças críticas
    const queueInterval = setInterval(() => {
      if (mountedRef.current && !gameCreationLockRef.current) {
        fetchQueuePlayers();
      }
    }, 800); // Reduzido de 1500ms para 800ms

    // Realtime para mudanças na fila - mais responsivo
    const queueChannel = supabase
      .channel('enhanced-matchmaking-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        (payload) => {
          console.log('🔄 Mudança na fila detectada:', payload.eventType);
          if (mountedRef.current && !gameCreationLockRef.current) {
            // Resposta imediata para mudanças críticas
            setTimeout(() => {
              if (mountedRef.current) {
                fetchQueuePlayers();
              }
            }, 100); // Reduzido de 200ms para 100ms
          }
        }
      )
      .subscribe();

    // Realtime para criação de jogos - detecção imediata
    const gamesChannel = supabase
      .channel('game-creation-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async () => {
          console.log('🎮 Novo jogo detectado, verificando imediatamente...');
          if (mountedRef.current) {
            // Verificação imediata
            setTimeout(async () => {
              const hasActiveGame = await checkUserActiveGame();
              if (hasActiveGame) {
                console.log('✅ Redirecionando para jogo ativo');
              }
            }, 200);
          }
        }
      )
      .subscribe();

    // Realtime para adição de jogadores - garantir que todos sejam redirecionados
    const gamePlayersChannel = supabase
      .channel('game-players-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        async (payload) => {
          console.log('👤 Jogador adicionado ao jogo:', payload.new);
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user && payload.new && 'user_id' in payload.new && payload.new.user_id === user.id) {
            console.log('🎯 Usuário atual adicionado ao jogo!');
            setTimeout(async () => {
              if (mountedRef.current) {
                const hasActiveGame = await checkUserActiveGame();
                if (hasActiveGame) {
                  console.log('🚀 Redirecionamento bem-sucedido');
                }
              }
            }, 100);
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
      supabase.removeChannel(gamePlayersChannel);
    };
  }, [fetchQueuePlayers, checkUserActiveGame, mountedRef, gameCreationLockRef]);
};
