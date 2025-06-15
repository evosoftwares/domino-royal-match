
import React, { useEffect, useState } from 'react';
import { ProcessedPlayer } from '@/types/game';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useForceExit } from '@/hooks/useForceExit';

interface WinnerDialogProps {
  winner: ProcessedPlayer | null;
  winType: 'empty_hand' | 'blocked' | 'timeout' | null;
  isVisible: boolean;
  currentUserId?: string;
}

const WinnerDialog: React.FC<WinnerDialogProps> = ({
  winner,
  winType,
  isVisible,
  currentUserId
}) => {
  const { forceExitToLobby } = useForceExit();
  const [countdown, setCountdown] = useState(10);
  
  // Timer automático de 10 segundos
  useEffect(() => {
    if (!isVisible || !winner) {
      setCountdown(10);
      return;
    }

    console.log('⏰ Iniciando timer automático de 10 segundos para finalizar jogo');
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          console.log('🕒 Timer expirado, redirecionando automaticamente');
          forceExitToLobby();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isVisible, winner, forceExitToLobby]);
  
  if (!isVisible || !winner) return null;

  const isCurrentUserWinner = winner.id === currentUserId;
  
  const getWinMessage = () => {
    switch (winType) {
      case 'empty_hand':
        return isCurrentUserWinner 
          ? '🎉 Parabéns! Você venceu jogando todas as suas peças!'
          : `${winner.name} venceu jogando todas as peças!`;
      case 'blocked':
        return isCurrentUserWinner
          ? '🎉 Parabéns! Você venceu com menos peças!'
          : `${winner.name} venceu com menos peças!`;
      case 'timeout':
        return isCurrentUserWinner
          ? '🎉 Parabéns! Você venceu por tempo!'
          : `${winner.name} venceu por tempo!`;
      default:
        return isCurrentUserWinner ? '🎉 Parabéns! Você venceu!' : `${winner.name} venceu!`;
    }
  };

  const handleBackToLobby = () => {
    console.log('🏠 WinnerDialog: Usuário solicitou volta ao lobby');
    forceExitToLobby();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={cn(
        "bg-gradient-to-br rounded-2xl p-8 max-w-md w-full text-center border-2 shadow-2xl animate-scale-in",
        isCurrentUserWinner 
          ? "from-green-900/90 to-emerald-800/90 border-green-400/50" 
          : "from-purple-900/90 to-blue-800/90 border-purple-400/50"
      )}>
        <div className="text-6xl mb-4">
          {isCurrentUserWinner ? '🏆' : '👑'}
        </div>
        
        <h2 className={cn(
          "text-2xl font-bold mb-2",
          isCurrentUserWinner ? "text-green-200" : "text-purple-200"
        )}>
          {isCurrentUserWinner ? 'Vitória!' : 'Fim de Jogo'}
        </h2>
        
        <p className={cn(
          "text-lg mb-6",
          isCurrentUserWinner ? "text-green-100" : "text-purple-100"
        )}>
          {getWinMessage()}
        </p>
        
        <div className="space-y-3">
          <div className={cn(
            "p-3 rounded-lg",
            isCurrentUserWinner ? "bg-green-800/30" : "bg-purple-800/30"
          )}>
            <p className="text-sm opacity-90">
              Peças restantes: {winner.pieces.length}
            </p>
          </div>

          {/* Timer de contagem regressiva */}
          <div className={cn(
            "p-3 rounded-lg border-2",
            countdown <= 3 
              ? "bg-red-800/30 border-red-400/50" 
              : "bg-yellow-800/30 border-yellow-400/50"
          )}>
            <p className="text-sm font-semibold">
              Redirecionando em {countdown} segundos...
            </p>
          </div>
          
          <Button 
            onClick={handleBackToLobby}
            className={cn(
              "w-full",
              isCurrentUserWinner 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-purple-600 hover:bg-purple-700"
            )}
          >
            Voltar ao Lobby Agora
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WinnerDialog;
