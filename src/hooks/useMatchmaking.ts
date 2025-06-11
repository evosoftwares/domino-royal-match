
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MatchmakingState {
  isInQueue: boolean;
  queueCount: number;
  isLoading: boolean;
  gameId: string | null;
}

interface MatchmakingResponse {
  success: boolean;
  error?: string;
  message?: string;
  queue_count?: number;
  game_id?: string;
  idJogoPleiteado?: number;
}

export const useMatchmaking = () => {
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null
  });

  const updateQueueCount = async () => {
    try {
      const { count } = await supabase
        .from('matchmaking_queue')
        .select('*', { count: 'exact' })
        .eq('status', 'searching')
        .eq('idjogopleiteado', 1);
      
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
        () => {
          updateQueueCount();
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
          checkIfUserInGame(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const joinQueue = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase.rpc('join_matchmaking_queue');
      
      if (error) throw error;
      
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          queueCount: response.queue_count || 0
        }));
        toast.success(response.message || 'Adicionado à fila');
        
        // Tentar criar jogo após entrar na fila
        await tryCreateGame();
      } else {
        toast.error(response.error || 'Erro ao entrar na fila');
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
      
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          queueCount: 0 
        }));
        toast.success(response.message || 'Removido da fila');
      } else {
        toast.error(response.error || 'Erro ao sair da fila');
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
      
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success && response.game_id) {
        console.log('Jogo criado com sucesso:', response.game_id);
      } else {
        console.log('Aguardando mais jogadores...');
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

        const { data: queueEntry } = await supabase
          .from('matchmaking_queue')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('status', 'searching')
          .single();

        if (queueEntry) {
          setState(prev => ({ ...prev, isInQueue: true }));
        }

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
