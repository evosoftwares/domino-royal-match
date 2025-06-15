
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

  const createGameFromQueue = async (playersInQueue: QueuePlayer[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || playersInQueue.length < 4 || playersInQueue[0].id !== user.id) {
      return;
    }

    try {
      const playersToStart = playersInQueue.slice(0, 4);
      const playerIds = playersToStart.map(p => p.id);

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
          board_state: initialBoardState,
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

      // Adicionar jogadores
      const gamePlayersData = playersToStart.map((player, index) => ({
        game_id: newGame.id,
        user_id: player.id,
        position: index + 1,
        hand: hands[index]
      }));

      const { error: playersError } = await supabase.from('game_players').insert(gamePlayersData);

      if (playersError) {
        await supabase.from('games').delete().eq('id', newGame.id);
        throw playersError;
      }

      // Atualizar fila
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'matched' })
        .in('user_id', playerIds);

      toast.success('Jogo criado! Você será redirecionado em breve.');

    } catch (error: any) {
      console.error('Erro ao criar jogo:', error);
      toast.error(`Falha ao criar o jogo: ${error.message}`);
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
            queueCount: 0
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
        
        if (players.length >= 4 && isUserInQueue) {
          await createGameFromQueue(players);
        }
      }

    } catch (error) {
      console.error('Erro ao buscar fila:', error);
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
    
    try {
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

      toast.success('Adicionado à fila com sucesso!');
      await fetchQueuePlayers();

    } catch (error: any) {
      console.error('Erro ao entrar na fila:', error);
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
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      setState(prev => ({ 
        ...prev, 
        isInQueue: false, 
        queueCount: 0,
        queuePlayers: []
      }));
      toast.success('Removido da fila');
      
    } catch (error: any) {
      console.error('Erro ao sair da fila:', error);
      toast.error(error.message || 'Erro ao sair da fila');
    } finally {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    fetchQueuePlayers();

    const queueInterval = setInterval(() => {
      if (mountedRef.current) {
        fetchQueuePlayers();
      }
    }, 2000);

    const queueChannel = supabase
      .channel('simple-matchmaking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => {
          if (mountedRef.current) {
            setTimeout(() => {
              if (mountedRef.current) {
                fetchQueuePlayers();
              }
            }, 300);
          }
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearInterval(queueInterval);
      supabase.removeChannel(queueChannel);
    };
  }, [navigate]);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
  };
};
