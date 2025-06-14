
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

      // Buscar jogo ativo com validação de integridade
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
        // Validar integridade do jogo antes do redirecionamento
        const isGameValid = validateGameIntegrity(activeGame);
        
        if (isGameValid) {
          console.log('✅ Jogo ativo válido encontrado:', activeGame.game_id);
          toast.success('Redirecionando para seu jogo ativo...');
          navigate(`/game2/${activeGame.game_id}`);
          return true;
        } else {
          console.warn('⚠️ Jogo encontrado mas inválido, aguardando nova criação...');
          // Tentar limpar jogo inválido
          await cleanupInvalidGame(activeGame.game_id);
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
      // Verificar se o jogo tem board_state válido
      const boardState = gameData.games?.board_state;
      if (!boardState || typeof boardState !== 'object') {
        console.warn('⚠️ Board state inválido:', boardState);
        return false;
      }

      // Verificar se board_state tem a estrutura correta
      const boardStateObj = boardState as Record<string, any>;
      if (!boardStateObj.pieces || !Array.isArray(boardStateObj.pieces)) {
        console.warn('⚠️ Board state sem peças válidas:', boardState);
        return false;
      }

      // Verificar se o jogador tem mão válida
      const hand = gameData.hand;
      if (!hand || !Array.isArray(hand)) {
        console.warn('⚠️ Mão do jogador inválida:', hand);
        return false;
      }

      // Verificar se há peças no tabuleiro (pelo menos a primeira peça)
      if (boardStateObj.pieces.length === 0) {
        console.warn('⚠️ Tabuleiro vazio, jogo pode estar mal formado');
        return false;
      }

      console.log('✅ Jogo validado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro na validação do jogo:', error);
      return false;
    }
  };

  const cleanupInvalidGame = async (gameId: string) => {
    try {
      console.log('🧹 Tentando limpar jogo inválido:', gameId);
      
      // Verificar quantos jogadores estão no jogo
      const { data: players } = await supabase
        .from('game_players')
        .select('user_id, hand')
        .eq('game_id', gameId);

      if (players && players.length > 0) {
        // Verificar se todos os jogadores têm mãos inválidas
        const allInvalid = players.every(p => !p.hand || !Array.isArray(p.hand) || p.hand.length === 0);
        
        if (allInvalid) {
          console.log('🗑️ Todos os jogadores têm mãos inválidas, marcando jogo como inválido');
          // Não deletar diretamente, apenas marcar como finished para evitar conflitos
          await supabase
            .from('games')
            .update({ status: 'finished' })
            .eq('id', gameId);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao limpar jogo inválido:', error);
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
        .gte('games.created_at', new Date(Date.now() - 120000).toISOString()); // Últimos 2 minutos

      if (existingGames && existingGames.length > 0) {
        // Verificar se os jogos existentes são válidos
        const validGames = existingGames.filter(game => {
          const boardState = game.games?.board_state;
          const hand = game.hand;
          return boardState && 
                 typeof boardState === 'object' &&
                 (boardState as Record<string, any>).pieces && 
                 Array.isArray((boardState as Record<string, any>).pieces) && 
                 (boardState as Record<string, any>).pieces.length > 0 &&
                 hand && 
                 Array.isArray(hand);
        });

        if (validGames.length > 0) {
          console.log('⚠️ Jogadores já estão em jogos ativos válidos:', validGames);
          return false; // Não criar novo jogo
        } else {
          console.log('🧹 Jogos existentes são inválidos, permitindo nova criação');
          // Limpar jogos inválidos
          for (const game of existingGames) {
            await cleanupInvalidGame(game.game_id);
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
    cleanupInvalidGame,
    isCheckingGame
  };
};
