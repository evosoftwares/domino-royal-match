
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MatchmakingState {
  isInQueue: boolean;
  queueCount: number;
  isLoading: boolean;
  gameId: string | null;
}

export const useMatchmaking = () => {
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null
  });

  // Subscrição em tempo real para monitorar a fila
  useEffect(() => {
    const channel = supabase
      .channel('matchmaking-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_queue'
        },
        async () => {
          // Atualizar contador da fila quando houver mudanças
          await updateQueueCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games'
        },
        (payload) => {
          console.log('Novo jogo criado:', payload);
          // Verificar se o usuário foi incluído neste jogo
          checkIfUserInGame(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateQueueCount = async () => {
    try {
      const { count } = await supabase
        .from('matchmaking_queue')
        .select('*', { count: 'exact' })
        .eq('status', 'searching');
      
      setState(prev => ({ ...prev, queueCount: count || 0 }));
    } catch (error) {
      console.error('Erro ao atualizar contador da fila:', error);
    }
  };

  const checkIfUserInGame = async (gameId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)
        .eq('user_id', user.user.id)
        .single();

      if (data) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          gameId: gameId 
        }));
        toast.success('Partida encontrada! Redirecionando...');
      }
    } catch (error) {
      console.error('Erro ao verificar se usuário está no jogo:', error);
    }
  };

  const joinQueue = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase.rpc('join_matchmaking_queue');
      
      if (error) throw error;
      
      if (data.success) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          queueCount: data.queue_count 
        }));
        toast.success(data.message);
        
        // Tentar criar jogo a cada nova entrada na fila
        await tryCreateGame();
      } else {
        toast.error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao entrar na fila');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const leaveQueue = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase.rpc('leave_matchmaking_queue');
      
      if (error) throw error;
      
      if (data.success) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          queueCount: 0 
        }));
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const tryCreateGame = async () => {
    try {
      const { data, error } = await supabase.rpc('create_game_when_ready');
      
      if (error) throw error;
      
      if (data.success) {
        console.log('Jogo criado:', data.game_id);
        // O realtime vai detectar a criação e redirecionar o usuário
      }
    } catch (error) {
      console.error('Erro ao tentar criar jogo:', error);
    }
  };

  // Verificar status inicial ao carregar
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        // Verificar se está na fila
        const { data: queueEntry } = await supabase
          .from('matchmaking_queue')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('status', 'searching')
          .single();

        if (queueEntry) {
          setState(prev => ({ ...prev, isInQueue: true }));
        }

        // Atualizar contador inicial
        await updateQueueCount();
      } catch (error) {
        console.error('Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue
  };
};
