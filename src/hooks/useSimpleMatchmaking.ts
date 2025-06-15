
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useGameCheck } from './useGameCheck';
import { generateDeck, shuffleDeck, dealHands, findStartingPlayer } from '@/utils/dominoSetup';

export interface QueuePlayer {
  id: string;
  displayName: string;
  avatarUrl: string;
  position: number;
}

export interface SimpleMatchmakingState {
  isInQueue: boolean;
  queueCount: number;
  isLoading: boolean;
  queuePlayers: QueuePlayer[];
}

export const useSimpleMatchmaking = () => {
  const navigate = useNavigate();
  const { checkUserActiveGame } = useGameCheck();
  const [state, setState] = useState<SimpleMatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    queuePlayers: []
  });

  const mountedRef = useRef(true);
  const gameCreationLockRef = useRef(false);

  const createGameFromQueue = async (playersInQueue: QueuePlayer[]) => {
    // Lock para evitar criação duplicada
    if (gameCreationLockRef.current || playersInQueue.length < 4) {
      return;
    }
    
    gameCreationLockRef.current = true;
    console.log('🎮 Iniciando criação de jogo com', playersInQueue.length, 'jogadores');

    try {
      const playersToStart = playersInQueue.slice(0, 4);
      const playerIds = playersToStart.map(p => p.id);

      // Verificar se já existe um jogo ativo para estes jogadores
      const { data: existingGame } = await supabase
        .from('game_players')
        .select('game_id, games!inner(status)')
        .in('user_id', playerIds)
        .eq('games.status', 'active')
        .limit(1);

      if (existingGame && existingGame.length > 0) {
        console.log('⚠️ Jogo já existe para estes jogadores');
        gameCreationLockRef.current = false;
        return;
      }

      const deck = generateDeck();
      const shuffledDeck = shuffleDeck(deck);
      const hands = dealHands(shuffledDeck);
      const startingInfo = findStartingPlayer(hands);

      if (!startingInfo) {
        throw new Error("Não foi possível determinar o jogador inicial.");
      }

      const { playerIndex: startingPlayerIndex, startingPiece, newHand } = startingInfo;
      const startingPlayerId = playerIds[startingPlayerIndex];
      hands[startingPlayerIndex] = newHand;

      const initialBoardState = {
        pieces: [{ piece: startingPiece, orientation: startingPiece.l === startingPiece.r ? 'vertical' : 'horizontal' }],
        left_end: startingPiece.l,
        right_end: startingPiece.r,
      };

      // Criar jogo
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          status: 'active',
          board_state: initialBoardState as any,
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

      console.log('✅ Jogo criado com ID:', newGame.id);

      // Adicionar jogadores
      const gamePlayersData = playersToStart.map((player, index) => ({
        game_id: newGame.id,
        user_id: player.id,
        position: index + 1,
        hand: hands[index] as any
      }));

      const { error: playersError } = await supabase.from('game_players').insert(gamePlayersData);

      if (playersError) {
        await supabase.from('games').delete().eq('id', newGame.id);
        throw playersError;
      }

      console.log('✅ Jogadores adicionados ao jogo');

      // Remover jogadores da fila
      const { error: queueError } = await supabase
        .from('matchmaking_queue')
        .delete()
        .in('user_id', playerIds);

      if (queueError) {
        console.error('⚠️ Erro ao limpar fila:', queueError);
      } else {
        console.log('✅ Fila limpa para jogadores do jogo');
      }

      toast.success('🎮 Jogo criado! Redirecionando...');
      
      // Aguardar um pouco para sincronização
      setTimeout(() => {
        if (mountedRef.current) {
          navigate(`/game2/${newGame.id}`);
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erro ao criar jogo:', error);
      toast.error(`Falha ao criar o jogo: ${error.message}`);
    } finally {
      gameCreationLockRef.current = false;
    }
  };

  const fetchQueuePlayers = async () => {
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
        
        // Verificar se pode criar jogo (4+ jogadores e não está em processo)
        if (players.length >= 4 && !gameCreationLockRef.current) {
          console.log('🎯 4+ jogadores na fila, criando jogo...');
          await createGameFromQueue(players);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao buscar fila:', error);
    }
  };

  const joinQueue = async () => {
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
      
      // Buscar fila atualizada
      await fetchQueuePlayers();

    } catch (error: any) {
      console.error('❌ Erro ao entrar na fila:', error);
      toast.error(error.message || 'Erro ao entrar na fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  };

  const leaveQueue = async () => {
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
  };

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

    // Polling mais frequente para detecção rápida
    const queueInterval = setInterval(() => {
      if (mountedRef.current && !gameCreationLockRef.current) {
        fetchQueuePlayers();
      }
    }, 1500);

    // Realtime para mudanças na fila
    const queueChannel = supabase
      .channel('simple-matchmaking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => {
          if (mountedRef.current && !gameCreationLockRef.current) {
            setTimeout(() => {
              if (mountedRef.current) {
                fetchQueuePlayers();
              }
            }, 200);
          }
        }
      )
      .subscribe();

    // Realtime para mudanças nos jogos (detecção de jogo criado)
    const gamesChannel = supabase
      .channel('games-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        async () => {
          console.log('🎮 Novo jogo detectado, verificando...');
          if (mountedRef.current) {
            setTimeout(async () => {
              const hasActiveGame = await checkUserActiveGame();
              if (hasActiveGame) {
                console.log('✅ Redirecionando para jogo ativo');
              }
            }, 500);
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
    };
  }, [navigate, checkUserActiveGame]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
  };
};
