import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const maxRetries = 12;
  const mountedRef = useRef(true);

  const fetchQueuePlayers = async () => {
    if (!mountedRef.current) return;
    
    try {
      console.log('📊 Buscando jogadores na fila...');
      
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

      if (queueError) {
        console.error('❌ Erro ao buscar fila:', queueError);
        return;
      }

      console.log('📋 Dados da fila recebidos:', queueData);

      if (!queueData || queueData.length === 0) {
        console.log('🔍 Nenhum jogador na fila');
        if (mountedRef.current) {
          setState(prev => ({ 
            ...prev, 
            queuePlayers: [], 
            queueCount: 0,
            isGameCreating: prev.isInQueue ? prev.isGameCreating : false
          }));
          
          if (!state.isInQueue) {
            setLastQueueCount(0);
            setRetryCount(0);
          }
        }
        return;
      }

      const players = queueData.map((queueItem, index): QueuePlayer => ({
        id: queueItem.user_id,
        displayName: queueItem.profiles?.full_name || 'Jogador Anônimo',
        avatarUrl: queueItem.profiles?.avatar_url || '',
        position: index + 1
      }));

      console.log(`📊 Jogadores na fila: ${players.length}`, players.map(p => ({ 
        id: p.id, 
        name: p.displayName 
      })));

      // Detectar quando chegamos a 4 jogadores
      const wasLessThan4 = lastQueueCount < 4;
      const isNow4OrMore = players.length >= 4;
      
      if (mountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          queuePlayers: players,
          queueCount: players.length,
          isGameCreating: prev.isGameCreating || isNow4OrMore
        }));
      }

      // Verificar se o usuário atual está na fila
      const { data: user } = await supabase.auth.getUser();
      if (user.user && mountedRef.current) {
        const isUserInQueue = players.some(player => player.id === user.user.id);
        console.log(`👤 Usuário ${user.user.id} na fila:`, isUserInQueue);
        
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
        
        // Se chegamos a 4 jogadores e usuário está na fila
        if (wasLessThan4 && isNow4OrMore && isUserInQueue) {
          console.log('🎯 4 jogadores detectados! Iniciando criação de jogo...');
          console.log('📝 Estado atual: wasLessThan4:', wasLessThan4, 'isNow4OrMore:', isNow4OrMore);
          
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          
          if (mountedRef.current) {
            const newTimer = setTimeout(() => {
              if (mountedRef.current) {
                console.log('⏰ Timer executado, iniciando verificação de jogo...');
                setRetryCount(0);
                checkForGameCreation(true);
              }
            }, 800);
            
            setDebounceTimer(newTimer);
          }
        }
      }

      setLastQueueCount(players.length);

    } catch (error) {
      console.error('❌ Erro crítico ao buscar participantes da fila:', error);
    }
  };

  const checkForGameCreation = useCallback(async (isInitialCheck = false) => {
    if (!mountedRef.current || retryCount >= maxRetries) {
      if (retryCount >= maxRetries) {
        console.warn('⚠️ Máximo de tentativas atingido para criação de jogo');
        setState(prev => ({ ...prev, isGameCreating: false }));
      }
      return;
    }

    console.log(`🔍 Verificando criação de jogo... (tentativa ${retryCount + 1}/${maxRetries})`);
    
    // Verificar se usuário foi redirecionado para jogo
    const gameFound = await checkUserActiveGame();
    
    if (gameFound) {
      console.log('✅ Jogo encontrado e usuário redirecionado!');
      setRetryCount(0);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isGameCreating: false }));
      }
      return;
    }
    
    // Continuar verificando se não atingiu limite
    if (retryCount < maxRetries && mountedRef.current) {
      setRetryCount(prev => prev + 1);
      
      // Intervalos progressivos mais inteligentes
      const delay = retryCount < 3 ? 600 : retryCount < 8 ? 1200 : 2000;
      console.log(`⏳ Próxima verificação em ${delay}ms`);
      
      setTimeout(() => {
        if (mountedRef.current) {
          checkForGameCreation(false);
        }
      }, delay);
    } else if (retryCount >= maxRetries && mountedRef.current) {
      console.warn('⚠️ Sistema bloqueado após tentativas máximas');
      toast.warning('Sistema seguro bloqueou após várias tentativas. Saia e entre na fila novamente.');
      setState(prev => ({ ...prev, isGameCreating: false }));
      setRetryCount(0);
    }
  }, [checkUserActiveGame, retryCount, maxRetries]);

  const checkUserBalance = async (): Promise<boolean> => {
    try {
      console.log('💰 Verificando saldo do usuário...');
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('❌ Usuário não autenticado');
        return false;
      }

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

      console.log(`💰 Saldo atual: R$ ${balance.toFixed(2)}, Mínimo: R$ ${minimumBalance.toFixed(2)}`);

      if (balance < minimumBalance) {
        console.warn(`⚠️ Saldo insuficiente: R$ ${balance.toFixed(2)}`);
        toast.error(`Saldo insuficiente. Você precisa de pelo menos R$ ${minimumBalance.toFixed(2)} para entrar na fila.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro crítico ao verificar saldo:', error);
      return false;
    }
  };

  const joinQueue = async () => {
    console.log('🚪 Iniciando entrada na fila...');
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const hasMinimumBalance = await checkUserBalance();
      if (!hasMinimumBalance) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('💰 Tentando entrar na fila com saldo válido...');
      const { data, error } = await supabase.rpc('join_matchmaking_queue');
      
      if (error) {
        console.error('❌ Erro RPC join_matchmaking_queue:', error);
        throw error;
      }
      
      console.log('📝 Resposta do RPC:', data);
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success) {
        console.log(`✅ Entrou na fila com sucesso! Total: ${response.queue_count} jogadores`);
        setState(prev => ({ 
          ...prev, 
          isInQueue: true, 
          queueCount: response.queue_count || 0
        }));
        toast.success(response.message || 'Adicionado à fila');
        
        setRetryCount(0);
        await fetchQueuePlayers();
      } else {
        console.error('❌ Falha na entrada da fila:', response.error);
        toast.error(response.error || 'Erro ao entrar na fila');
      }
    } catch (error: any) {
      console.error('❌ Erro crítico ao entrar na fila:', error);
      toast.error(error.message || 'Erro ao entrar na fila');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const leaveQueue = async () => {
    console.log('🚪 Iniciando saída da fila...');
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase.rpc('leave_matchmaking_queue');
      
      if (error) {
        console.error('❌ Erro RPC leave_matchmaking_queue:', error);
        throw error;
      }
      
      console.log('📝 Resposta do RPC:', data);
      const response = data as unknown as MatchmakingResponse;
      
      if (response.success) {
        console.log('✅ Saiu da fila com sucesso');
        setState(prev => ({ 
          ...prev, 
          isInQueue: false, 
          queueCount: 0,
          queuePlayers: [],
          isGameCreating: false
        }));
        toast.success(response.message || 'Removido da fila');
        setRetryCount(0);
        setLastQueueCount(0);
        
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          setDebounceTimer(null);
        }
      } else {
        console.error('❌ Falha na saída da fila:', response.error);
        toast.error(response.error || 'Erro ao sair da fila');
      }
    } catch (error: any) {
      console.error('❌ Erro crítico ao sair da fila:', error);
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const checkInitialStatus = async () => {
      if (!mountedRef.current) return;
      
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user || !mountedRef.current) return;

        console.log('🔍 Matchmaking: Verificando status inicial do sistema...');
        console.log('👤 Usuário autenticado:', user.user.id);
        await fetchQueuePlayers();
      } catch (error) {
        console.error('❌ Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();

    // Polling otimizado
    const queueInterval = setInterval(() => {
      if (mountedRef.current) {
        fetchQueuePlayers();
      }
    }, 1000);

    // Canais realtime otimizados
    console.log('📡 Configurando canais realtime...');
    
    const queueChannel = supabase
      .channel('secure-matchmaking-v4')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        (payload) => {
          console.log('🔄 Mudança na fila detectada:', payload.eventType, payload);
          if (mountedRef.current) {
            setTimeout(() => {
              if (mountedRef.current) {
                fetchQueuePlayers();
              }
            }, 300);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status canal fila:', status);
      });

    // Canal para criação de jogos
    const gameChannel = supabase
      .channel('secure-game-creation-v4')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async (payload) => {
          console.log('🎯 Novo jogo detectado:', payload.new);
          if (mountedRef.current) {
            setTimeout(async () => {
              if (mountedRef.current) {
                const gameFound = await checkUserActiveGame();
                if (gameFound) {
                  console.log('✅ Redirecionamento bem-sucedido!');
                  setState(prev => ({ ...prev, isGameCreating: false }));
                  setRetryCount(0);
                }
              }
            }, 400);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status canal jogos:', status);
      });

    // Canal para game_players
    const gamePlayersChannel = supabase
      .channel('secure-game-players-v4')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        async (payload) => {
          console.log('👤 Jogador adicionado:', payload.new);
          const { data: user } = await supabase.auth.getUser();
          if (user.user && payload.new.user_id === user.user.id) {
            console.log('🎮 Usuário atual adicionado ao jogo!');
            setTimeout(async () => {
              if (mountedRef.current) {
                const gameFound = await checkUserActiveGame();
                if (gameFound) {
                  setState(prev => ({ ...prev, isGameCreating: false }));
                  setRetryCount(0);
                }
              }
            }, 200);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status canal jogadores:', status);
      });

    console.log('📡 Sistema v4.0 ativado - Canais realtime configurados');

    return () => {
      console.log('🧹 Limpando sistema de matchmaking...');
      mountedRef.current = false;
      clearInterval(queueInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(gamePlayersChannel);
      
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      console.log('🧹 Cleanup concluído');
    };
  }, [navigate, debounceTimer]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
    retryCount,
    maxRetries
  };
};
