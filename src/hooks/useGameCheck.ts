
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useForceExit } from './useForceExit';

export const useGameCheck = () => {
  const navigate = useNavigate();
  const { hasForceExit, clearForceExit } = useForceExit();

  const checkUserActiveGame = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔍 Verificando jogo ativo do usuário...');
      
      // Verificar se há intenção de sair forçadamente
      if (hasForceExit()) {
        console.log('🚪 Usuário quer sair do jogo - ignorando redirecionamento automático');
        clearForceExit();
        return false;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ Usuário não autenticado para verificação de jogo');
        return false;
      }

      console.log('👤 Verificando jogos para usuário:', user.id);

      // Verificar se usuário está em jogo ativo
      const { data: gameData, error } = await supabase
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
        .limit(1);

      if (error) {
        console.error('❌ Erro ao verificar jogo ativo:', error);
        return false;
      }

      console.log('📋 Dados de jogo encontrados:', gameData);

      if (gameData && gameData.length > 0) {
        const gameId = gameData[0].game_id;
        console.log(`🎮 Jogo ativo encontrado: ${gameId}`);
        
        // Verificar novamente se não há intenção de sair (double-check)
        if (hasForceExit()) {
          console.log('🚪 Usuário quer sair do jogo - não redirecionando');
          clearForceExit();
          return false;
        }
        
        console.log('🚀 Redirecionando para o jogo...');
        navigate(`/game2/${gameId}`);
        return true;
      }

      console.log('🔍 Nenhum jogo ativo encontrado');
      return false;
    } catch (error) {
      console.error('❌ Erro crítico ao verificar jogo ativo:', error);
      return false;
    }
  }, [navigate, hasForceExit, clearForceExit]);

  return {
    checkUserActiveGame
  };
};
