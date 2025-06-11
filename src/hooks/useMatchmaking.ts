
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QueuePlayer {
  id: string;
  displayName: string;
  avatarUrl: string;
  position: number;
}

export interface MatchmakingState {
  isInQueue: boolean;
  queueCount: number;
  isLoading: boolean;
  gameId: string | null;
  queuePlayers: QueuePlayer[];
}

interface MatchmakingResponse {
  success: boolean;
  error?: string;
  message?: string;
  queue_count?: number;
  game_id?: string;
  idjogopleiteado?: number;
}

export const useMatchmaking = () => {
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null,
    queuePlayers: []
  });

  const fetchQueuePlayers = async () => {
    try {
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id, created_at')
        .eq('status', 'searching')
        .eq('idjogopleiteado', 1)
        .order('created_at', { ascending: true });

      if (queueError) {
        console.error('Erro ao buscar fila:', queueError);
        return;
      }

      if (!queueData || queueData.length === 0) {
        setState(prev => ({ ...prev, queuePlayers: [], queueCount: 0 }));
        return;
      }

      const userIds = queueData.map(item => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Erro ao buscar perfis:', profilesError);
        return;
      }

      const profilesMap = new Map(profilesData.map(p => [p.id, p]));
      const players = queueData.map((queueItem, index): QueuePlayer => {
        const profile = profilesMap.get(queueItem.user_id);
        return {
          id: queueItem.user_id,
          displayName: profile?.full_name || 'Anônimo',
          avatarUrl: profile?.avatar_url || '',
          position: index + 1
        };
      });

      setState(prev => ({ 
        ...prev, 
        queuePlayers: players,
        queueCount: players.length
      }));

      // Verificar se o usuário atual está na fila
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const isUserInQueue = players.some(player => player.id === user.user.id);
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
      }

    } catch (error) {
      console.error('Erro ao buscar participantes da fila:', error);
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
        .maybeSingle();

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
      
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success) {
        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          queueCount: response.queue_count || 0
        }));
        toast.success(response.message || 'Adicionado à fila');
        
        // Atualizar lista de participantes imediatamente
        await fetchQueuePlayers();
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
          queueCount: 0,
          queuePlayers: []
        }));
        toast.success(response.message || 'Removido da fila');
        
        // Atualizar lista de participantes imediatamente
        await fetchQueuePlayers();
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

  // Polling automático para atualizar participantes da fila
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        await fetchQueuePlayers();
      } catch (error) {
        console.error('Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();

    // Polling a cada 3 segundos para manter a fila atualizada
    const interval = setInterval(() => {
      fetchQueuePlayers();
    }, 3000);

    // Canal de tempo real para detectar criação de jogos
    const channel = supabase
      .channel('game-creation')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        (payload) => {
          console.log('Novo jogo detectado:', payload.new.id);
          checkIfUserInGame(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers
  };
};
