
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

  const checkUserActiveGame = async () => {
    if (!user || isCheckingGame) return false;

    setIsCheckingGame(true);

    try {
      // CORRIGIDO: Remover referência a games.created_at na ordenação
      const { data: activeGame } = await supabase
        .from('game_players')
        .select(`
          game_id,
          games!inner(
            id,
            status,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('games.status', 'active')
        .order('created_at', { ascending: false, referencedTable: 'games' })
        .limit(1)
        .maybeSingle();

      if (activeGame?.game_id) {
        console.log('🎮 Usuário já tem jogo ativo:', activeGame.game_id);
        toast.info('Redirecionando para seu jogo ativo...');
        navigate(`/game2/${activeGame.game_id}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar jogo ativo:', error);
      return false;
    } finally {
      setIsCheckingGame(false);
    }
  };

  const preventDuplicateGameCreation = async (userIds: string[]) => {
    try {
      // Verificar se algum dos usuários já está em jogo ativo
      const { data: existingGames } = await supabase
        .from('game_players')
        .select(`
          user_id,
          game_id,
          games!inner(status, created_at)
        `)
        .in('user_id', userIds)
        .eq('games.status', 'active')
        .gte('games.created_at', new Date(Date.now() - 120000).toISOString()); // Últimos 2 minutos

      if (existingGames && existingGames.length > 0) {
        console.log('⚠️ Jogadores já estão em jogos ativos:', existingGames);
        return false; // Não criar novo jogo
      }

      return true; // OK para criar novo jogo
    } catch (error) {
      console.error('Erro ao verificar jogos duplicados:', error);
      return false;
    }
  };

  return {
    checkUserActiveGame,
    preventDuplicateGameCreation,
    isCheckingGame
  };
};
