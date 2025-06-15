
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useForceExit = () => {
  const setForceExit = useCallback(() => {
    console.log('🚪 Marcando intenção de sair do jogo forçadamente');
    sessionStorage.setItem('domino_force_exit', 'true');
    sessionStorage.setItem('domino_force_exit_timestamp', Date.now().toString());
  }, []);

  const clearForceExit = useCallback(() => {
    console.log('🧹 Limpando flag de saída forçada');
    sessionStorage.removeItem('domino_force_exit');
    sessionStorage.removeItem('domino_force_exit_timestamp');
  }, []);

  const hasForceExit = useCallback((): boolean => {
    const hasFlag = sessionStorage.getItem('domino_force_exit') === 'true';
    
    if (hasFlag) {
      // Verificar se a flag não é muito antiga (5 minutos)
      const timestamp = sessionStorage.getItem('domino_force_exit_timestamp');
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp);
        const maxAge = 5 * 60 * 1000; // 5 minutos
        
        if (age > maxAge) {
          console.log('🕐 Flag de saída forçada expirou, limpando...');
          clearForceExit();
          return false;
        }
      }
      
      console.log('✅ Flag de saída forçada ativa');
      return true;
    }
    
    return false;
  }, [clearForceExit]);

  const forceExitToLobby = useCallback(async () => {
    console.log('🎯 Executando saída forçada para o lobby');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ Usuário não autenticado para saída forçada');
        return;
      }

      console.log('🗑️ Removendo usuário de jogos ativos...');
      
      // Primeiro, encontrar jogos ativos do usuário
      const { data: activeGames, error: fetchError } = await supabase
        .from('game_players')
        .select(`
          game_id,
          games!inner(
            id,
            status
          )
        `)
        .eq('user_id', user.id)
        .eq('games.status', 'active');

      if (fetchError) {
        console.error('❌ Erro ao buscar jogos ativos:', fetchError);
      } else if (activeGames && activeGames.length > 0) {
        console.log(`🎮 Encontrados ${activeGames.length} jogos ativos, finalizando...`);
        
        // Finalizar cada jogo ativo
        for (const gamePlayer of activeGames) {
          const { error: updateError } = await supabase
            .from('games')
            .update({ 
              status: 'abandoned',
              updated_at: new Date().toISOString()
            })
            .eq('id', gamePlayer.game_id);

          if (updateError) {
            console.error('❌ Erro ao finalizar jogo:', updateError);
          } else {
            console.log(`✅ Jogo ${gamePlayer.game_id} finalizado com sucesso`);
          }
        }
      } else {
        console.log('ℹ️ Nenhum jogo ativo encontrado para finalizar');
      }
    } catch (error) {
      console.error('❌ Erro crítico ao executar saída forçada:', error);
    }

    // Marcar flag e redirecionar
    setForceExit();
    
    // Pequeno delay para garantir que as operações do banco sejam concluídas
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }, [setForceExit]);

  return {
    setForceExit,
    clearForceExit,
    hasForceExit,
    forceExitToLobby
  };
};
