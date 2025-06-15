
import { useCallback } from 'react';

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

  const forceExitToLobby = useCallback(() => {
    console.log('🎯 Executando saída forçada para o lobby');
    setForceExit();
    
    // Pequeno delay para garantir que a flag seja definida
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  }, [setForceExit]);

  return {
    setForceExit,
    clearForceExit,
    hasForceExit,
    forceExitToLobby
  };
};
