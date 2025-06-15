import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useGameCheck } from './useGameCheck';
import { generateDeck, shuffleDeck, dealHands, findStartingPlayer, DominoPiece } from '@/utils/dominoSetup';

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
  queuePlayers: QueuePlayer[];
  isGameCreating: boolean;
}

export const useMatchmaking = () => {
  const navigate = useNavigate();
  const { checkUserActiveGame } = useGameCheck();
  const [state, setState] = useState<MatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    queuePlayers: [],
    isGameCreating: false
  });

  const mountedRef = useRef(true);

  const createGameFromQueue = async (playersInQueue: QueuePlayer[]) => {
    // Apenas o primeiro jogador da fila (o líder) cria o jogo.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || playersInQueue.length < 4 || playersInQueue[0].id !== user.id) {
      if (playersInQueue.length >= 4) {
        console.log('... Não é o líder, aguardando criação do jogo.');
      }
      return;
    }

    // Previne tentativas duplicadas de criação do mesmo cliente.
    if (state.isGameCreating) {
      console.log('... Criação de jogo já em progresso por este cliente.');
      return;
    }

    // Checa se um jogo já foi criado para este usuário para evitar race conditions.
    const gameFound = await checkUserActiveGame();
    if (gameFound) {
      console.log('... Jogo já encontrado, cancelando criação.');
      return;
    }

    console.log('👑 Você é o líder! Criando o jogo...');
    setState(prev => ({ ...prev, isGameCreating: true }));
    toast.info('Você é o líder da sala! Criando o jogo...');

    try {
      const playersToStart = playersInQueue.slice(0, 4);
      const playerIds = playersToStart.map(p => p.id);

      // 1. Lógica do jogo (distribuir cartas, achar jogador inicial)
      const deck = generateDeck();
      const shuffledDeck = shuffleDeck(deck);
      const hands = dealHands(shuffledDeck);
      const startingInfo = findStartingPlayer(hands);

      if (!startingInfo) {
        throw new Error("Não foi possível determinar o jogador inicial.");
      }

      const { playerIndex: startingPlayerIndex, startingPiece, newHand } = startingInfo;
      const startingPlayerId = playerIds[startingPlayerIndex];
      hands[startingPlayerIndex] = newHand; // Atualiza a mão do jogador inicial

      const initialBoardState = {
        pieces: [{ piece: startingPiece, orientation: startingPiece.l === startingPiece.r ? 'vertical' : 'horizontal' }],
        left_end: startingPiece.l,
        right_end: startingPiece.r,
      };
      
      console.log('⚙️ Lógica do jogo preparada. Peça inicial:', startingPiece);

      // 2. Criar registro do jogo no DB
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          status: 'active',
          board_state: JSON.parse(JSON.stringify(initialBoardState)),
          current_player_turn: startingPlayerId,
          turn_start_time: new Date().toISOString(),
          prize_pool: 4.00,
          entry_fee: 1.10
        })
        .select()
        .single();

      if (gameError || !newGame) {
        throw gameError || new Error("Falha ao criar o registro do jogo.");
      }
      
      console.log('✅ Jogo criado no banco de dados:', newGame.id);

      // 3. Adicionar jogadores ao jogo
      const gamePlayersData = playersToStart.map((player, index) => ({
        game_id: newGame.id,
        user_id: player.id,
        position: index + 1,
        hand: JSON.parse(JSON.stringify(hands[index]))
      }));

      const { error: playersError } = await supabase.from('game_players').insert(gamePlayersData);

      if (playersError) {
        // Tenta limpar o jogo órfão em caso de falha
        console.error('❌ Erro ao adicionar jogadores. Tentando limpar...', playersError);
        await supabase.from('games').delete().eq('id', newGame.id);
        throw playersError;
      }

      console.log('👥 Jogadores adicionados ao jogo com sucesso.');

      // 4. Atualizar status na fila de matchmaking
      const { error: queueError } = await supabase
        .from('matchmaking_queue')
        .update({ status: 'matched' })
        .in('user_id', playerIds);

      if (queueError) {
        // Falha não-crítica, apenas registrar.
        console.warn('⚠️ Erro ao atualizar o status na fila de matchmaking:', queueError);
      }

      console.log('🏁 Processo de criação de jogo finalizado com sucesso.');
      toast.success('Jogo criado! Você será redirecionado em breve.');

    } catch (error: any) {
      console.error('❌ Erro crítico durante a criação do jogo:', error);
      toast.error(`Falha ao criar o jogo: ${error.message}`);
      // Reseta o estado para permitir nova tentativa.
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isGameCreating: false }));
      }
    }
  };

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
      const { data: { user } } = await supabase.auth.getUser();
      if (user && mountedRef.current) {
        const isUserInQueue = players.some(player => player.id === user.id);
        console.log(`👤 Usuário ${user.id} na fila:`, isUserInQueue);
        
        setState(prev => ({ ...prev, isInQueue: isUserInQueue }));
        
        // Se chegamos a 4 jogadores e usuário está na fila, iniciar criação.
        if (isNow4OrMore && isUserInQueue) {
          console.log('🎯 4+ jogadores detectados. Iniciando processo de criação do lado do cliente...');
          // A eleição de líder ocorre dentro da função createGameFromQueue
          await createGameFromQueue(players);
        }
      }

    } catch (error) {
      console.error('❌ Erro crítico ao buscar participantes da fila:', error);
    }
  };

  const checkUserBalance = async (): Promise<boolean> => {
    try {
      console.log('💰 Verificando saldo do usuário...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        return false;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', user.id)
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
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado para entrar na fila.");
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      const hasMinimumBalance = await checkUserBalance();
      if (!hasMinimumBalance) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('🕵️ Verificando se já está na fila...');
      const { data: existing, error: checkError } = await supabase
        .from('matchmaking_queue')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('status', 'searching')
        .maybeSingle();

      if (checkError) {
        console.error('❌ Erro ao verificar fila existente:', checkError);
        throw checkError;
      }
      
      if (existing) {
        toast.info("Você já está na fila.");
        await fetchQueuePlayers();
        return;
      }
      
      console.log('➕ Adicionando à fila...');
      const { error: insertError } = await supabase
        .from('matchmaking_queue')
        .insert({ user_id: user.id, status: 'searching', idjogopleiteado: 1 });

      if (insertError) {
        console.error('❌ Erro ao inserir na fila:', insertError);
        throw insertError;
      }

      toast.success('Adicionado à fila com sucesso!');
      await fetchQueuePlayers();

    } catch (error: any) {
      console.error('❌ Erro crítico ao entrar na fila:', error);
      toast.error(error.message || 'Erro ao entrar na fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  };

  const leaveQueue = async () => {
    console.log('🚪 Iniciando saída da fila...');
    setState(prev => ({ ...prev, isLoading: true }));
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    
    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ Erro ao remover da fila:', error);
        throw error;
      }
      
      console.log('✅ Saiu da fila com sucesso');
      setState(prev => ({ 
        ...prev, 
        isInQueue: false, 
        queueCount: 0,
        queuePlayers: [],
        isGameCreating: false
      }));
      toast.success('Removido da fila');
      
    } catch (error: any) {
      console.error('❌ Erro crítico ao sair da fila:', error);
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const checkInitialStatus = async () => {
      if (!mountedRef.current) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mountedRef.current) return;

        console.log('🔍 Matchmaking: Verificando status inicial do sistema...');
        console.log('👤 Usuário autenticado:', user.id);
        await fetchQueuePlayers();
      } catch (error) {
        console.error('❌ Erro ao verificar status inicial:', error);
      }
    };

    checkInitialStatus();

    // O polling continua sendo um backup importante caso o realtime falhe.
    const queueInterval = setInterval(() => {
      if (mountedRef.current) {
        fetchQueuePlayers();
      }
    }, 1000);

    // Canais realtime otimizados
    console.log('📡 Configurando canais realtime...');
    
    const queueChannel = supabase
      .channel('secure-matchmaking-v5')
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
      .channel('secure-game-creation-v5')
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
      .channel('secure-game-players-v5')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_players' },
        async (payload) => {
          console.log('👤 Jogador adicionado:', payload.new);
          // Corrigido: Acessar o usuário corretamente com 'user.id'
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.user_id === user.id) {
            console.log('🎮 Usuário atual adicionado ao jogo!');
            setTimeout(async () => {
              if (mountedRef.current) {
                const gameFound = await checkUserActiveGame();
                if (gameFound) {
                  setState(prev => ({ ...prev, isGameCreating: false }));
                }
              }
            }, 200);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status canal jogadores:', status);
      });

    console.log('📡 Sistema v5.0 ativado - Criação de jogo no cliente');

    return () => {
      console.log('🧹 Limpando sistema de matchmaking...');
      mountedRef.current = false;
      clearInterval(queueInterval);
      supabase.removeChannel(queueChannel);
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(gamePlayersChannel);
      
      console.log('🧹 Cleanup concluído');
    };
  }, [navigate]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
  };
};
