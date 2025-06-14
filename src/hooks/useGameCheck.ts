
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const useGameCheck = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCheckingGame, setIsCheckingGame] = useState(false);
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  // Verificar se o usuário já está em um jogo ativo ao carregar - COM DEBOUNCE
  useEffect(() => {
    if (user && !checkingRef.current) {
      const now = Date.now();
      if (now - lastCheckRef.current > 1000) { // Debounce de 1 segundo
        lastCheckRef.current = now;
        checkUserActiveGame();
      }
    }
  }, [user]);

  const checkUserActiveGame = async (): Promise<boolean> => {
    if (!user || checkingRef.current) return false;

    checkingRef.current = true;
    setIsCheckingGame(true);

    try {
      console.log('🔍 Verificando jogo ativo para usuário:', user.id);

      // Buscar jogo ativo com validação rigorosa usando novo sistema
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
        // Validação rigorosa do jogo usando sistema seguro
        const isGameValid = await validateGameIntegritySecure(activeGame);
        
        if (isGameValid) {
          console.log('✅ Jogo ativo válido encontrado (sistema seguro):', activeGame.game_id);
          toast.success('Redirecionando para seu jogo ativo...');
          
          // Usar setTimeout para evitar problemas de navegação
          setTimeout(() => {
            navigate(`/game2/${activeGame.game_id}`);
          }, 100);
          
          return true;
        } else {
          console.warn('⚠️ Jogo encontrado mas invalidado pelo sistema seguro');
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Erro ao verificar jogo ativo:', error);
      return false;
    } finally {
      checkingRef.current = false;
      setIsCheckingGame(false);
    }
  };

  const validateGameIntegritySecure = async (gameData: any): Promise<boolean> => {
    try {
      const game = gameData.games;
      const playerHand = gameData.hand;

      console.log('🛡️ Validação segura do jogo:', {
        gameId: game?.id,
        status: game?.status,
        boardState: game?.board_state,
        handSize: playerHand ? (Array.isArray(playerHand) ? playerHand.length : 'not array') : 'null',
        prizePool: game?.prize_pool,
        entryFee: game?.entry_fee
      });

      // Validações básicas
      if (!game || game.status !== 'active') {
        console.warn('⚠️ Jogo não existe ou não está ativo');
        return false;
      }

      if (!game.prize_pool || !game.entry_fee || game.prize_pool <= 0 || game.entry_fee <= 0) {
        console.warn('⚠️ Prize pool ou entry fee inválidos');
        return false;
      }

      if (!playerHand || !Array.isArray(playerHand)) {
        console.warn('⚠️ Mão do jogador inválida');
        return false;
      }

      // Validação do board_state com sistema seguro
      const boardState = game.board_state;
      if (!boardState || typeof boardState !== 'object') {
        console.warn('⚠️ Board state inválido');
        return false;
      }

      if (!boardState.pieces || !Array.isArray(boardState.pieces) || boardState.pieces.length === 0) {
        console.warn('⚠️ Board state sem peças válidas');
        return false;
      }

      if (typeof boardState.left_end !== 'number' || typeof boardState.right_end !== 'number') {
        console.warn('⚠️ Extremidades do tabuleiro inválidas');
        return false;
      }

      if (!game.current_player_turn) {
        console.warn('⚠️ Turno atual inválido');
        return false;
      }

      // Verificação segura de outros jogadores
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

      // Validação segura das mãos dos jogadores com verificação de tipo
      for (const player of otherPlayers) {
        if (!player.hand || !Array.isArray(player.hand)) {
          console.warn('⚠️ Jogador tem mão inválida:', player.user_id);
          return false;
        }
      }

      // Verificação de idade do jogo com sistema seguro
      const gameAge = Date.now() - new Date(game.created_at).getTime();
      const maxGameAge = 3 * 60 * 60 * 1000; // 3 horas
      
      if (gameAge > maxGameAge) {
        console.warn('⚠️ Jogo muito antigo, sistema seguro o invalidou');
        return false;
      }

      // Validação adicional: verificar se o jogo não foi criado por sistema corrompido
      const totalPieces = playerHand.length + otherPlayers.reduce((sum, p) => {
        return sum + (Array.isArray(p.hand) ? p.hand.length : 0);
      }, 0) + boardState.pieces.length;
      
      if (totalPieces > 28) {
        console.warn('⚠️ Sistema seguro detectou mais peças que o permitido');
        return false;
      }

      console.log('✅ Jogo validado pelo sistema seguro - todas as verificações passaram');
      return true;
    } catch (error) {
      console.error('❌ Erro na validação segura do jogo:', error);
      return false;
    }
  };

  const preventDuplicateGameCreationSecure = async (userIds: string[]) => {
    try {
      // Verificação segura contra jogos duplicados
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
        .gte('games.created_at', new Date(Date.now() - 180000).toISOString()); // Últimos 3 minutos

      if (existingGames && existingGames.length > 0) {
        // Verificar se os jogos encontrados são válidos usando sistema seguro
        for (const gamePlayer of existingGames) {
          const isValid = await validateGameIntegritySecure(gamePlayer);
          if (isValid) {
            console.log('⚠️ Sistema seguro: jogador já está em jogo ativo:', gamePlayer.user_id);
            return false; // Não criar novo jogo
          }
        }
      }

      return true; // OK para criar novo jogo
    } catch (error) {
      console.error('❌ Erro na verificação segura de jogos duplicados:', error);
      return false;
    }
  };

  return {
    checkUserActiveGame,
    preventDuplicateGameCreation: preventDuplicateGameCreationSecure,
    validateGameIntegrity: validateGameIntegritySecure,
    isCheckingGame
  };
};
