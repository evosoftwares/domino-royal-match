
import { useMemo } from 'react';
import { ProcessedPlayer } from '@/types/game';

interface UseGameWinCheckProps {
  players: ProcessedPlayer[];
  gameStatus: string;
}

interface WinState {
  hasWinner: boolean;
  winner: ProcessedPlayer | null;
  isGameEnded: boolean;
  winType: 'empty_hand' | 'blocked' | 'timeout' | null;
}

export const useGameWinCheck = ({ players, gameStatus }: UseGameWinCheckProps): WinState => {
  return useMemo(() => {
    // Se o jogo não está ativo, verificar se terminou
    if (gameStatus === 'finished' || gameStatus === 'completed') {
      // Procurar jogador com menos peças (ou sem peças)
      const sortedPlayers = [...players].sort((a, b) => a.pieces.length - b.pieces.length);
      const potentialWinner = sortedPlayers[0];
      
      if (potentialWinner && potentialWinner.pieces.length === 0) {
        return {
          hasWinner: true,
          winner: potentialWinner,
          isGameEnded: true,
          winType: 'empty_hand'
        };
      } else if (potentialWinner) {
        return {
          hasWinner: true,
          winner: potentialWinner,
          isGameEnded: true,
          winType: 'blocked'
        };
      }
    }

    // Verificação local de vitória por mão vazia
    const emptyHandPlayer = players.find(player => player.pieces.length === 0);
    if (emptyHandPlayer) {
      return {
        hasWinner: true,
        winner: emptyHandPlayer,
        isGameEnded: true,
        winType: 'empty_hand'
      };
    }

    return {
      hasWinner: false,
      winner: null,
      isGameEnded: gameStatus !== 'active',
      winType: null
    };
  }, [players, gameStatus]);
};
