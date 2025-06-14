
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null,
    queuePlayers: []
  });

  const fetchQueuePlayers = async () => {
    try {
      // Busca todos os usuários na fila de matchmaking
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select(`
          user_id,
          created_at,
          profiles!inner(
            id,
            full_name,
            avatar_url
          )
        `)
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

      // Mapeia os dados para o formato QueuePlayer
      const players = queueData.map((queueItem, index): QueuePlayer => ({
        id: queueItem.user_id,
        displayName: queueItem.profiles?.full_name || 'Anônimo',
        avatarUrl: queueItem.profiles?.avatar_url || '',
        position: index + 1
      }));

      console.log('Jogadores na fila:', players.length);

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

  const checkUserInActiveGame = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Verificar se o usuário está em algum jogo ativo - CORRIGIDO SQL
      const { data: activeGame, error } = await supabase
        .from('game_players')
        .select(`
          game_id,
          games!inner(
            id,
            status,
            created_at
          )
        `)
        .eq('user_id', user.user.id)
        .eq('games.status', 'active')
        .order('created_at', { ascending: false, referencedTable: 'games' })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar jogo ativo:', error);
        return;
      }

      if (activeGame?.game_id) {
        console.log('🎮 Usuário encontrado em jogo ativo:', activeGame.game_id);
        toast.success('Partida encontrada! Redirecionando...');
        navigate(`/game2/${activeGame.game_id}`);
      }
    } catch (error) {
      console.error('Erro ao verificar se usuário está no jogo:', error);
    }
  };

  const checkUserBalance = async (): Promise<boolean> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.user.id)
        .single();

      if (error) {
        console.error('Erro ao verificar saldo:', error);
        return false;
      }

      const balance = profile?.balance || 0;
      const minimumBalance = 2.20; // Taxa de entrada mínima

      if (balance < minimumBalance) {
        toast.error(`Saldo insuficiente. Você precisa de pelo menos R$ ${minimumBalance.toFixed(2)} para entrar na fila.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar saldo:', error);
      return false;
    }
  };

  const joinQueue = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Verifica o saldo antes de entrar na fila
      const hasMinimumBalance = await checkUserBalance();
      if (!hasMinimumBalance) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('💰 Tentando entrar na fila...');
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
        console.log('✅ Entrou na fila com sucesso. Total de jogadores:', response.queue_count);
        
        // Atualizar a lista de jogadores imediatamente
        await fetchQueuePlayers();
      } else {
        toast.error(response.error || 'Erro ao entrar na fila');
      }
    } catch (error: any) {
      console.error('❌ Erro ao entrar na fila:', error);
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
        console.log('🚪 Saiu da fila com sucesso');
      } else {
        toast.error(response.error || 'Erro ao sair da fila');
      }
    } catch (error: any) {
      console.error('❌ Erro ao sair da fila:', error);
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        console.log('🔍 Verificando status inicial...');
        await fetchQueuePlayers();
      } catch (error) {
        console.error('Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();

    // Polling mais agressivo para atualizar a fila quando há muitos jogadores
    const queueInterval = setInterval(() => {
      fetchQueuePlayers();
    }, 1000); // Reduzido para 1 segundo

    // Verificação mais frequente se o usuário foi inserido em um jogo ativo
    const gameCheckInterval = setInterval(() => {
      checkUserInActiveGame();
    }, 2000); // Reduzido para 2 segundos

    // Canal de tempo real para detectar mudanças na fila de matchmaking
    const queueChannel = supabase
      .channel('enhanced-matchmaking-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        (payload) => {
          console.log('🔄 Mudança na fila detectada:', payload.eventType, payload.new || payload.old);
          // Atualizar a fila imediatamente quando houver mudanças
          setTimeout(() => {
            fetchQueuePlayers();
          }, 100);
        }
      )
      .subscribe();

    // Canal de tempo real para detectar criação de jogos
    const gameChannel = supabase
      .channel('enhanced-game-creation')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        (payload) => {
          console.log('🎯 Novo jogo detectado:', payload.new);
          // Verificar imediatamente se o usuário está neste jogo
          setTimeout(() => {
            checkUserInActiveGame();
          }, 200);
        }
      )
      .subscribe();

    // Canal para detectar mudanças nos jogadores do jogo
    const gamePlayersChannel = supabase
      .channel('enhanced-game-players')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        (payload) => {
          console.log('👤 Jogador adicionado ao jogo:', payload.new);
          // Verificar se é o usuário atual
          setTimeout(() => {
            checkUserInActiveGame();
          }, 300);
        }
      )
      .subscribe();

    console.log('📡 Canais de realtime configurados');

    return () => {
      clearInterval(queueInterval);
      clearInterval(gameCheckInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(gamePlayersChannel);
      console.log('🧹 Cleanup do matchmaking concluído');
    };
  }, [navigate]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers
  };
};
