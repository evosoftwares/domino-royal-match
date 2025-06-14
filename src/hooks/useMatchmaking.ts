
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
  isGameCreating: boolean;
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
  const { checkUserActiveGame } = useGameCheck();
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    gameId: null,
    queuePlayers: [],
    isGameCreating: false
  });

  const [retryCount, setRetryCount] = useState(0);
  const [lastQueueCount, setLastQueueCount] = useState(0);
  const maxRetries = 15; // Mais tentativas para garantir detecção

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
        setLastQueueCount(0);
        return;
      }

      const players = queueData.map((queueItem, index): QueuePlayer => ({
        id: queueItem.user_id,
        displayName: queueItem.profiles?.full_name || 'Anônimo',
        avatarUrl: queueItem.profiles?.avatar_url || '',
        position: index + 1
      }));

      console.log(`📊 Jogadores na fila: ${players.length}`);

      // Detectar quando chegamos a 4 jogadores
      const wasLessThan4 = lastQueueCount < 4;
      const isNow4OrMore = players.length >= 4;
      
      setState(prev => ({ 
        ...prev, 
        queuePlayers: players,
        queueCount: players.length,
        isGameCreating: isNow4OrMore
      }));

      // Verificar se o usuário atual está na fila
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        const isUserInQueue = players.some(player => player.id === user.user.id);
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
        
        // Se acabamos de chegar a 4 jogadores e o usuário está na fila
        if (wasLessThan4 && isNow4OrMore && isUserInQueue) {
          console.log('🎯 4 jogadores detectados! Iniciando verificação...');
          setRetryCount(0);
          // Verificação mais rápida
          setTimeout(() => checkForGameCreation(true), 200);
        }
      }

      setLastQueueCount(players.length);

    } catch (error) {
      console.error('❌ Erro ao buscar participantes da fila:', error);
    }
  };

  const checkForGameCreation = useCallback(async (isInitialCheck = false) => {
    console.log(`🔍 Verificando criação de jogo... (tentativa ${retryCount + 1}/${maxRetries})`);
    
    // Verificar se usuário foi redirecionado para jogo
    const gameFound = await checkUserActiveGame();
    
    if (gameFound) {
      console.log('✅ Jogo encontrado e usuário redirecionado!');
      setRetryCount(0);
      setState(prev => ({ ...prev, isGameCreating: false }));
      return;
    }
    
    // Se não encontrou jogo, tentar novamente
    if (retryCount < maxRetries) {
      console.log(`⏳ Jogo não encontrado, tentativa ${retryCount + 1}/${maxRetries}`);
      setRetryCount(prev => prev + 1);
      
      // Intervalos otimizados: começar rápido e aumentar gradualmente
      const delay = isInitialCheck ? 500 : Math.min(500 + (retryCount * 500), 3000);
      setTimeout(() => checkForGameCreation(false), delay);
    } else {
      console.warn('⚠️ Jogo não foi criado após várias tentativas, resetando...');
      toast.warning('Parece que houve um problema. Tente sair e entrar na fila novamente.');
      setState(prev => ({ ...prev, isGameCreating: false }));
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
        
        setRetryCount(0);
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
        setRetryCount(0);
        setLastQueueCount(0);
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

    // Polling mais frequente para detecção rápida
    const queueInterval = setInterval(fetchQueuePlayers, 500);

    // Canais realtime ultra-otimizados
    const queueChannel = supabase
      .channel('ultra-optimized-matchmaking-v6')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        (payload) => {
          console.log('🔄 Mudança na fila via realtime:', payload.eventType);
          setTimeout(fetchQueuePlayers, 100);
        }
      )
      .subscribe();

    // Canal para criação de jogos
    const gameChannel = supabase
      .channel('ultra-optimized-game-creation-v6')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async (payload) => {
          console.log('🎯 Novo jogo detectado via realtime:', payload.new);
          setTimeout(async () => {
            const gameFound = await checkUserActiveGame();
            if (gameFound) {
              console.log('✅ Redirecionamento via realtime bem-sucedido!');
              setState(prev => ({ ...prev, isGameCreating: false }));
            }
          }, 100);
        }
      )
      .subscribe();

    // Canal para game_players
    const gamePlayersChannel = supabase
      .channel('ultra-optimized-game-players-v6')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        async (payload) => {
          console.log('👤 Jogador adicionado via realtime:', payload.new);
          const { data: user } = await supabase.auth.getUser();
          if (user.user && payload.new.user_id === user.user.id) {
            console.log('🎮 Usuário atual foi adicionado ao jogo!');
            setTimeout(async () => {
              const gameFound = await checkUserActiveGame();
              if (gameFound) {
                setState(prev => ({ ...prev, isGameCreating: false }));
              }
            }, 50);
          }
        }
      )
      .subscribe();

    console.log('📡 Canais realtime v6 ultra-otimizados configurados');

    return () => {
      clearInterval(queueInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(gamePlayersChannel);
      console.log('🧹 Cleanup do matchmaking v6 concluído');
    };
  }, [navigate]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
    retryCount,
    maxRetries
  };
};
