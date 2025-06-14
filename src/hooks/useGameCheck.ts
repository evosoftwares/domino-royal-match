
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

      // Buscar jogo ativo com validação de integridade melhorada
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
        // Validação melhorada para distinguir entre "jogo iniciando" vs "jogo corrompido"
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

      // Verificar se o jogo foi criado recentemente (últimos 5 minutos)
      const gameAge = Date.now() - new Date(game.created_at).getTime();
      const isRecentGame = gameAge < 5 * 60 * 1000; // 5 minutos

      // Para jogos recentes, ser mais permissivo com board_state
      if (isRecentGame) {
        console.log('✅ Jogo recente detectado, validação permissiva');
        
        // Verificar se o jogador tem mão válida (mais importante)
        if (!playerHand || !Array.isArray(playerHand) || playerHand.length === 0) {
          console.warn('⚠️ Mão do jogador inválida:', playerHand);
          return false;
        }

        // Para jogos recém-criados, board_state pode estar sendo configurado
        return true;
      }

      // Para jogos mais antigos, validação completa
      const boardState = game.board_state;
      if (!boardState || typeof boardState !== 'object') {
        console.warn('⚠️ Board state inválido:', boardState);
        return false;
      }

      // Verificar se board_state tem estrutura correta
      const boardStateObj = boardState as Record<string, any>;
      if (!boardStateObj.pieces || !Array.isArray(boardStateObj.pieces)) {
        console.warn('⚠️ Board state sem peças válidas:', boardState);
        return false;
      }

      // Verificar se o jogador tem mão válida
      if (!playerHand || !Array.isArray(playerHand)) {
        console.warn('⚠️ Mão do jogador inválida:', playerHand);
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
      // Verificar se algum dos usuários já está em jogo ativo VÁLIDO
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
        .gte('games.created_at', new Date(Date.now() - 60000).toISOString()); // Último minuto

      if (existingGames && existingGames.length > 0) {
        // Verificar se os jogos existentes são válidos com validação melhorada
        const validGames = existingGames.filter(game => {
          return validateGameIntegrity(game);
        });

        if (validGames.length > 0) {
          console.log('⚠️ Jogadores já estão em jogos ativos válidos:', validGames);
          return false; // Não criar novo jogo
        } else {
          console.log('🧹 Jogos existentes são inválidos, permitindo nova criação');
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
