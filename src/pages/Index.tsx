
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGameCheck } from '@/hooks/useGameCheck';
import { useForceExit } from '@/hooks/useForceExit';
import MatchmakingQueue from '@/components/MatchmakingQueue';
import UserBalance from '@/components/UserBalance';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { checkUserActiveGame } = useGameCheck();
  const { clearForceExit } = useForceExit();

  // Verificar jogo ativo na inicialização - com controle de força de saída
  useEffect(() => {
    let mounted = true;
    
    const initializeIndex = async () => {
      if (!user || !mounted) return;
      
      console.log('🏠 Index: Inicializando verificação de jogo ativo');
      
      // Limpar qualquer flag de saída antiga ao entrar no lobby
      clearForceExit();
      
      // Pequeno delay para garantir que tudo está carregado
      setTimeout(async () => {
        if (mounted) {
          const hasActiveGame = await checkUserActiveGame();
          if (hasActiveGame) {
            console.log('🎮 Index: Usuário redirecionado para jogo ativo');
          } else {
            console.log('✅ Index: Usuário pode usar a fila de matchmaking');
          }
        }
      }, 500);
    };

    initializeIndex();

    return () => {
      mounted = false;
    };
  }, [user, checkUserActiveGame, clearForceExit]);

  const handleLogout = async () => {
    clearForceExit(); // Limpar flags ao fazer logout
    await logout();
    navigate('/auth');
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header com Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/cd2d3373-317b-49d5-bd6f-880dd6f2fa12.png" 
              alt="Dominó Money" 
              className="h-16 w-16 object-fill" 
            />
            <div className="text-white">
              <h1 className="text-2xl font-bold">Dominó Money</h1>
              <p className="text-purple-200 text-sm">Sistema Seguro v3.0 Ativo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <UserBalance />
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              size="sm" 
              className="bg-purple-900/50 border-purple-600/30 text-purple-200 hover:bg-purple-800/50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Matchmaking Queue */}
        <div className="flex justify-center">
          <MatchmakingQueue />
        </div>
      </div>
    </div>
  );
};

export default Index;
