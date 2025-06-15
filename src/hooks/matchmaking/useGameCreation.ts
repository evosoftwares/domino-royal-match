
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { generateDeck, shuffleDeck, dealHands, findStartingPlayer } from '@/utils/dominoSetup';
import { QueuePlayer } from './types';

export const useGameCreation = () => {
  const navigate = useNavigate();
  const gameCreationLockRef = useRef(false);

  const createGameFromQueue = useCallback(async (playersInQueue: QueuePlayer[]) => {
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
        navigate(`/game2/${newGame.id}`);
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erro ao criar jogo:', error);
      toast.error(`Falha ao criar o jogo: ${error.message}`);
    } finally {
      gameCreationLockRef.current = false;
    }
  }, [navigate]);

  return {
    createGameFromQueue,
    gameCreationLockRef
  };
};
