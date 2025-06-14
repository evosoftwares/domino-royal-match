
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useGameCheck = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCheckingGame, setIsCheckingGame] = useState(false);

  // Verificar se o usuário já está em um jogo ativo ao carregar
  useEffect(() => {
    if (user) {
      checkUserActiveGame();
    }
  }, [user]);

  const checkUserActiveGame = async (): Promise<boolean> => {
    if (!user || isCheckingGame) return false;

    setIsCheckingGame(true);

    try {
      console.log('🔍 Verificando jogo ativo para usuário:', user.id);

      // Buscar jogo ativo com validação rigorosa
      const { data: activeGame, error } = await supabase
        .from('game_players')
        .select(`
          game_id,
          hand,
          position,
          games!inner(
            id,
            status,
            created_at,
            board_state,
            current_player_turn,
            prize_pool,
            entry_fee
          )
        `)
        .eq('user_id', user.id)
        .eq('games.status', 'active')
        .order('created_at', { ascending: false, referencedTable: 'games' })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao verificar jogo ativo:', error);
        return false;
      }

      if (activeGame?.game_id) {
        // Validação rigorosa do jogo
        const isGameValid = await validateGameIntegrity(activeGame);
        
        if (isGameValid) {
          console.log('✅ Jogo ativo válido encontrado:', activeGame.game_id);
          toast.success('Redirecionando para seu jogo ativo...');
          navigate(`/game2/${activeGame.game_id}`);
          return true;
        } else {
          console.warn('⚠️ Jogo encontrado mas inválido');
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Erro ao verificar jogo ativo:', error);
      return false;
    } finally {
      setIsCheckingGame(false);
    }
  };

  const validateGameIntegrity = async (gameData: any): Promise<boolean> => {
    try {
      const game = gameData.games;
      const playerHand = gameData.hand;

      console.log('🔍 Validando jogo:', {
        gameId: game?.id,
        status: game?.status,
        boardState: game?.board_state,
        handSize: playerHand ? (Array.isArray(playerHand) ? playerHand.length : 'not array') : 'null',
        prizePool: game?.prize_pool,
        entryFee: game?.entry_fee
      });

      // 1. Verificar se o jogo existe e está ativo
      if (!game || game.status !== 'active') {
        console.warn('⚠️ Jogo não existe ou não está ativo');
        return false;
      }

      // 2. Verificar se tem prize pool e entry fee válidos
      if (!game.prize_pool || !game.entry_fee || game.prize_pool <= 0 || game.entry_fee <= 0) {
        console.warn('⚠️ Prize pool ou entry fee inválidos');
        return false;
      }

      // 3. Verificar se o jogador tem mão válida
      if (!playerHand || !Array.isArray(playerHand)) {
        console.warn('⚠️ Mão do jogador inválida');
        return false;
      }

      // 4. Verificar se board_state existe e é válido
      const boardState = game.board_state;
      if (!boardState || typeof boardState !== 'object') {
        console.warn('⚠️ Board state inválido');
        return false;
      }

      // 5. Verificar se board_state tem estrutura esperada
      if (!boardState.pieces || !Array.isArray(boardState.pieces) || boardState.pieces.length === 0) {
        console.warn('⚠️ Board state sem peças válidas');
        return false;
      }

      // 6. Verificar se as extremidades do tabuleiro são válidas
      if (typeof boardState.left_end !== 'number' || typeof boardState.right_end !== 'number') {
        console.warn('⚠️ Extremidades do tabuleiro inválidas');
        return false;
      }

      // 7. Verificar se o turno atual é válido
      if (!game.current_player_turn) {
        console.warn('⚠️ Turno atual inválido');
        return false;
      }

      // 8. Verificar se há outros jogadores no jogo
      const { data: otherPlayers, error: playersError } = await supabase
        .from('game_players')
        .select('user_id, position, hand')
        .eq('game_id', game.id)
        .neq('user_id', user.id);

      if (playersError) {
        console.warn('⚠️ Erro ao verificar outros jogadores:', playersError);
        return false;
      }

      if (!otherPlayers || otherPlayers.length < 1) {
        console.warn('⚠️ Jogo sem outros jogadores válidos');
        return false;
      }

      // 9. Verificar se cada jogador tem mão válida
      for (const player of otherPlayers) {
        if (!player.hand || !Array.isArray(player.hand)) {
          console.warn('⚠️ Jogador tem mão inválida:', player.user_id);
          return false;
        }
      }

      // 10. Verificar se o jogo não é muito antigo (evitar jogos abandonados)
      const gameAge = Date.now() - new Date(game.created_at).getTime();
      const maxGameAge = 2 * 60 * 60 * 1000; // 2 horas
      
      if (gameAge > maxGameAge) {
        console.warn('⚠️ Jogo muito antigo, pode estar abandonado');
        return false;
      }

      console.log('✅ Jogo validado com sucesso - todas as verificações passaram');
      return true;
    } catch (error) {
      console.error('❌ Erro na validação do jogo:', error);
      return false;
    }
  };

  const preventDuplicateGameCreation = async (userIds: string[]) => {
    try {
      // Verificar se algum dos usuários já está em jogo ativo recente
      const { data: existingGames } = await supabase
        .from('game_players')
        .select(`
          user_id,
          game_id,
          hand,
          games!inner(
            status, 
            created_at,
            board_state,
            prize_pool
          )
        `)
        .in('user_id', userIds)
        .eq('games.status', 'active')
        .gte('games.created_at', new Date(Date.now() - 300000).toISOString()); // Últimos 5 minutos

      if (existingGames && existingGames.length > 0) {
        // Verificar se os jogos encontrados são válidos
        for (const gamePlayer of existingGames) {
          const isValid = await validateGameIntegrity(gamePlayer);
          if (isValid) {
            console.log('⚠️ Jogador já está em jogo ativo válido:', gamePlayer.user_id);
            return false; // Não criar novo jogo
          }
        }
      }

      return true; // OK para criar novo jogo
    } catch (error) {
      console.error('❌ Erro ao verificar jogos duplicados:', error);
      return false;
    }
  };

  return {
    checkUserActiveGame,
    preventDuplicateGameCreation,
    validateGameIntegrity,
    isCheckingGame
  };
};
