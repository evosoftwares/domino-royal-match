
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QueuePlayer, SimpleMatchmakingState } from './types';
import { useGameCheck } from '@/hooks/useGameCheck';

interface UseQueueManagementProps {
  setState: React.Dispatch<React.SetStateAction<SimpleMatchmakingState>>;
  mountedRef: React.MutableRefObject<boolean>;
  createGameFromQueue: (players: QueuePlayer[]) => Promise<void>;
}

export const useQueueManagement = ({ setState, mountedRef, createGameFromQueue }: UseQueueManagementProps) => {
  const { checkUserActiveGame } = useGameCheck();

  const fetchQueuePlayers = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select(`
          user_id,
          created_at,
          status,
          idjogopleiteado,
          profiles!inner(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('status', 'searching')
        .eq('idjogopleiteado', 1)
        .order('created_at', { ascending: true });

      if (queueError || !queueData || queueData.length === 0) {
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            queuePlayers: [], 
            queueCount: 0,
            isInQueue: false
          }));
        }
        return;
      }

      const players = queueData.map((queueItem, index): QueuePlayer => ({
        id: queueItem.user_id,
        displayName: queueItem.profiles?.full_name || 'Jogador Anônimo',
        avatarUrl: queueItem.profiles?.avatar_url || '',
        position: index + 1
      }));

      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          queuePlayers: players,
          queueCount: players.length
        }));
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user && mountedRef.current) {
        const isUserInQueue = players.some(player => player.id === user.id);
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
        
        // Criar jogo quando 4+ jogadores (com melhor sincronização)
        if (players.length >= 4) {
          console.log('🎯 4+ jogadores detectados, iniciando criação de jogo...');
          // Timeout para limpeza automática se jogo não for criado
          const timeoutId = setTimeout(async () => {
            console.log('⚠️ Timeout na criação do jogo, limpando fila órfã');
            await cleanupStaleQueue();
          }, 10000); // 10 segundos
          
          try {
            await createGameFromQueue(players);
            clearTimeout(timeoutId);
          } catch (error) {
            clearTimeout(timeoutId);
            console.error('❌ Erro na criação do jogo:', error);
          }
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar fila:', error);
    }
  }, [setState, mountedRef, createGameFromQueue]);

  const cleanupStaleQueue = useCallback(async () => {
    try {
      // Remove entradas antigas da fila (mais de 2 minutos)
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .lt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('❌ Erro ao limpar fila:', error);
      } else {
        console.log('🧹 Fila limpa com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro crítico na limpeza da fila:', error);
    }
  }, []);

  const joinQueue = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado para entrar na fila.");
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Verificar se já tem jogo ativo
    const hasActiveGame = await checkUserActiveGame();
    if (hasActiveGame) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      console.log('👤 Entrando na fila:', user.id);

      const { error: insertError } = await supabase
        .from('matchmaking_queue')
        .insert({ 
          user_id: user.id, 
          status: 'searching', 
          idjogopleiteado: 1 
        });

      if (insertError) {
        throw insertError;
      }

      console.log('✅ Usuário adicionado à fila');
      toast.success('Adicionado à fila com sucesso!');
      
      // Atualizar estado imediatamente
      setState(prev => ({ ...prev, isInQueue: true }));
      
      // Buscar fila atualizada com delay mínimo
      setTimeout(() => {
        fetchQueuePlayers();
      }, 100);

    } catch (error: any) {
      console.error('❌ Erro ao entrar na fila:', error);
      toast.error(error.message || 'Erro ao entrar na fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [checkUserActiveGame, fetchQueuePlayers, setState, mountedRef]);

  const leaveQueue = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      console.log('🚪 Saindo da fila:', user.id);

      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Usuário removido da fila');
      
      setState(prev => ({ 
        ...prev, 
        isInQueue: false
      }));
      
      toast.success('Removido da fila');
      
      // Atualizar fila
      await fetchQueuePlayers();
      
    } catch (error: any) {
      console.error('❌ Erro ao sair da fila:', error);
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [fetchQueuePlayers, setState, mountedRef]);

  return {
    fetchQueuePlayers,
    joinQueue,
    leaveQueue
  };
};
