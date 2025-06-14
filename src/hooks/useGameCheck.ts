
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

      // Buscar jogo ativo - simplificado para trabalhar com as novas políticas RLS
      const { data: activeGame, error } = await supabase
        .from('game_players')
        .select(`
          game_id,
          hand,
          games!inner(
            id,
            status,
            created_at,
            board_state,
            current_player_turn
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
        // Validação muito mais permissiva para garantir que funcione
        const isGameValid = validateGameIntegrity(activeGame);
        
        if (isGameValid) {
          console.log('✅ Jogo ativo válido encontrado:', activeGame.game_id);
          toast.success('Redirecionando para seu jogo ativo...');
          navigate(`/game2/${activeGame.game_id}`);
          return true;
        } else {
          console.warn('⚠️ Jogo encontrado mas inválido, permitindo nova busca...');
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

  const validateGameIntegrity = (gameData: any): boolean => {
    try {
      const game = gameData.games;
      const playerHand = gameData.hand;

      console.log('🔍 Validando jogo:', {
        gameId: game?.id,
        status: game?.status,
        boardState: game?.board_state,
        handSize: playerHand ? (Array.isArray(playerHand) ? playerHand.length : 'not array') : 'null'
      });

      // Verificação básica - o jogo deve existir e estar ativo
      if (!game || game.status !== 'active') {
        console.warn('⚠️ Jogo não existe ou não está ativo');
        return false;
      }

      // Verificar se o jogador tem mão (mesmo que vazia é válido)
      if (!playerHand || !Array.isArray(playerHand)) {
        console.warn('⚠️ Mão do jogador inválida');
        return false;
      }

      // Para jogos recentes (últimos 15 minutos), ser muito permissivo
      const gameAge = Date.now() - new Date(game.created_at).getTime();
      const isRecentGame = gameAge < 15 * 60 * 1000; // 15 minutos

      if (isRecentGame) {
        console.log('✅ Jogo recente detectado, validação permissiva aprovada');
        return true;
      }

      // Para jogos mais antigos, verificar board_state básico
      const boardState = game.board_state;
      if (!boardState || typeof boardState !== 'object') {
        console.warn('⚠️ Board state inválido para jogo antigo');
        return false;
      }

      console.log('✅ Jogo validado com sucesso');
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
            board_state
          )
        `)
        .in('user_id', userIds)
        .eq('games.status', 'active')
        .gte('games.created_at', new Date(Date.now() - 300000).toISOString()); // Últimos 5 minutos

      if (existingGames && existingGames.length > 0) {
        console.log('⚠️ Jogadores já estão em jogos ativos recentes:', existingGames);
        return false; // Não criar novo jogo
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
