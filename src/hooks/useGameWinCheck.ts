
import { useMemo, useEffect } from 'react';
import { ProcessedPlayer } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';

interface UseGameWinCheckProps {
  players: ProcessedPlayer[];
  gameStatus: string;
  gameId?: string;
}

interface WinState {
  hasWinner: boolean;
  winner: ProcessedPlayer | null;
  isGameEnded: boolean;
  winType: 'empty_hand' | 'blocked' | 'timeout' | null;
}

export const useGameWinCheck = ({ players, gameStatus, gameId }: UseGameWinCheckProps): WinState => {
  const winState = useMemo(() => {
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
          winType: 'empty_hand' as const
        };
      } else if (potentialWinner) {
        return {
          hasWinner: true,
          winner: potentialWinner,
          isGameEnded: true,
          winType: 'blocked' as const
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
        winType: 'empty_hand' as const
      };
    }

    return {
      hasWinner: false,
      winner: null,
      isGameEnded: gameStatus !== 'active',
      winType: null
    };
  }, [players, gameStatus]);

  // Efeito para finalizar o jogo automaticamente quando há um vencedor
  useEffect(() => {
    if (winState.hasWinner && gameStatus === 'active' && gameId) {
      console.log('🏆 Vencedor detectado, finalizando jogo automaticamente:', winState.winner?.name);
      
      // Finalizar o jogo no banco de dados
      const finalizeGame = async () => {
        try {
          const { error } = await supabase
            .from('games')
            .update({ 
              status: 'finished',
              winner_id: winState.winner?.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', gameId);

          if (error) {
            console.error('❌ Erro ao finalizar jogo:', error);
          } else {
            console.log('✅ Jogo finalizado com sucesso no banco de dados');
          }
        } catch (error) {
          console.error('❌ Erro crítico ao finalizar jogo:', error);
        }
      };

      finalizeGame();
    }
  }, [winState.hasWinner, winState.winner?.id, gameStatus, gameId]);

  return winState;
};
