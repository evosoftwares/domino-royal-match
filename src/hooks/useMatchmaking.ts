
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useGameCheck } from './useGameCheck';

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
  isGameCreating: boolean; // Novo estado para indicar criação de jogo
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
  const { checkUserActiveGame, validateGameIntegrity } = useGameCheck();
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null,
    queuePlayers: [],
    isGameCreating: false
  });

  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const fetchQueuePlayers = async () => {
    try {
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
        console.error('❌ Erro ao buscar fila:', queueError);
        return;
      }

      if (!queueData || queueData.length === 0) {
        setState(prev => ({ 
          ...prev, 
          queuePlayers: [], 
          queueCount: 0,
          isGameCreating: false 
        }));
        return;
      }

      const players = queueData.map((queueItem, index): QueuePlayer => ({
        id: queueItem.user_id,
        displayName: queueItem.profiles?.full_name || 'Anônimo',
        avatarUrl: queueItem.profiles?.avatar_url || '',
        position: index + 1
      }));

      console.log(`📊 Jogadores na fila: ${players.length}`);

      setState(prev => ({ 
        ...prev, 
        queuePlayers: players,
        queueCount: players.length,
        isGameCreating: players.length >= 4 // Indicar que jogo está sendo criado
      }));

      // Verificar se o usuário atual está na fila
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const isUserInQueue = players.some(player => player.id === user.user.id);
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
        
        // Se temos 4+ jogadores e o usuário está na fila, verificar criação de jogo
        if (players.length >= 4 && isUserInQueue) {
          console.log('🎯 4 jogadores detectados, aguardando criação automática...');
          // Aguardar um pouco e verificar se jogo foi criado
          setTimeout(checkForGameCreation, 2000);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar participantes da fila:', error);
    }
  };

  const checkForGameCreation = useCallback(async () => {
    console.log('🔍 Verificando se jogo foi criado automaticamente...');
    
    // Verificar se usuário foi redirecionado para jogo
    const gameFound = await checkUserActiveGame();
    
    if (!gameFound && retryCount < maxRetries) {
      console.log(`⏳ Jogo não encontrado, tentativa ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      
      // Aguardar mais um pouco e tentar novamente
      setTimeout(checkForGameCreation, 3000);
    } else if (!gameFound && retryCount >= maxRetries) {
      console.warn('⚠️ Jogo não foi criado após várias tentativas');
      toast.warning('Houve um problema na criação automática do jogo. Tente sair e entrar na fila novamente.');
      setState(prev => ({ ...prev, isGameCreating: false }));
      setRetryCount(0);
    } else if (gameFound) {
      console.log('✅ Jogo encontrado e usuário redirecionado!');
      setRetryCount(0);
    }
  }, [checkUserActiveGame, retryCount]);

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
        console.error('❌ Erro ao verificar saldo:', error);
        return false;
      }

      const balance = profile?.balance || 0;
      const minimumBalance = 2.20;

      if (balance < minimumBalance) {
        toast.error(`Saldo insuficiente. Você precisa de pelo menos R$ ${minimumBalance.toFixed(2)} para entrar na fila.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao verificar saldo:', error);
      return false;
    }
  };

  const joinQueue = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
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
        console.log(`✅ Entrou na fila com sucesso. Total de jogadores: ${response.queue_count}`);
        
        setRetryCount(0); // Reset retry count on successful join
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
          queuePlayers: [],
          isGameCreating: false
        }));
        toast.success(response.message || 'Removido da fila');
        console.log('🚪 Saiu da fila com sucesso');
        setRetryCount(0); // Reset retry count
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
        console.error('❌ Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();

    // Polling mais agressivo para detectar mudanças
    const queueInterval = setInterval(fetchQueuePlayers, 1000);

    // Verificação periódica se usuário foi inserido em jogo
    const gameCheckInterval = setInterval(async () => {
      if (state.isGameCreating) {
        await checkUserActiveGame();
      }
    }, 2000);

    // Canais de realtime otimizados
    const queueChannel = supabase
      .channel('enhanced-matchmaking-queue-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        (payload) => {
          console.log('🔄 Mudança na fila detectada:', payload.eventType);
          setTimeout(fetchQueuePlayers, 100);
        }
      )
      .subscribe();

    // Canal específico para criação de jogos com validação
    const gameChannel = supabase
      .channel('enhanced-game-creation-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async (payload) => {
          console.log('🎯 Novo jogo detectado:', payload.new);
          // Aguardar um pouco para que o jogo seja totalmente criado
          setTimeout(async () => {
            const gameFound = await checkUserActiveGame();
            if (gameFound) {
              console.log('✅ Redirecionamento via realtime bem-sucedido!');
            }
          }, 1000);
        }
      )
      .subscribe();

    // Canal para detectar adição de jogadores ao jogo
    const gamePlayersChannel = supabase
      .channel('enhanced-game-players-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        async (payload) => {
          console.log('👤 Jogador adicionado ao jogo:', payload.new);
          const { data: user } = await supabase.auth.getUser();
          if (user.user && payload.new.user_id === user.user.id) {
            console.log('🎮 Usuário atual foi adicionado ao jogo!');
            setTimeout(checkUserActiveGame, 500);
          }
        }
      )
      .subscribe();

    console.log('📡 Canais de realtime v2 configurados com validação');

    return () => {
      clearInterval(queueInterval);
      clearInterval(gameCheckInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(gamePlayersChannel);
      console.log('🧹 Cleanup do matchmaking v2 concluído');
    };
  }, [navigate, state.isGameCreating]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
    retryCount,
    maxRetries
  };
};
