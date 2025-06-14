
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DominoPieceType } from '@/types/game';
import { validateMove, toBackendFormat } from '@/utils/pieceValidation';

interface UseServerSyncProps {
  gameId: string;
  boardState: any;
}

export const useServerSync = ({ gameId, boardState }: UseServerSyncProps) => {
  const syncPlayMove = useCallback(async (piece: DominoPieceType) => {
    try {
      // Peça já está padronizada no formato {top, bottom}
      console.log('Sincronizando movimento com servidor. Peça padronizada:', { 
        top: piece.top, 
        bottom: piece.bottom 
      });

      // Usa formato original se disponível, senão converte da peça padronizada
      const pieceForRPC = piece.originalFormat || toBackendFormat({ top: piece.top, bottom: piece.bottom });
      console.log('Formato para RPC:', pieceForRPC);

      const validation = validateMove(piece, boardState);
      
      if (!validation.isValid || !validation.side) {
        console.error('Validação falhou no servidor:', validation.error);
        return false;
      }
      
      const { error } = await supabase.rpc('play_move', {
        p_game_id: gameId,
        p_piece: pieceForRPC,
        p_side: validation.side
      });

      if (error) {
        console.error('Erro RPC play_move:', error);
        throw error;
      }
      
      console.log('Movimento sincronizado com sucesso no servidor');
      return true;
    } catch (error) {
      console.error('Erro na sincronização de jogada:', error);
      return false;
    }
  }, [gameId, boardState]);

  const syncPassTurn = useCallback(async () => {
    try {
      console.log('Sincronizando passe de turno com servidor');
      
      const { error } = await supabase.rpc('pass_turn', {
        p_game_id: gameId
      });

      if (error) {
        console.error('Erro RPC pass_turn:', error);
        throw error;
      }
      
      console.log('Passe sincronizado com sucesso no servidor');
      return true;
    } catch (error) {
      console.error('Erro na sincronização de passe:', error);
      return false;
    }
  }, [gameId]);

  const syncAutoPlay = useCallback(async () => {
    try {
      console.log('Sincronizando auto play com servidor');
      
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameId,
      });
      
      if (error) {
        console.error('Erro RPC auto_play:', error);
        throw error;
      }
      
      console.log('Auto play sincronizado com sucesso no servidor');
      return true;
    } catch (error) {
      console.error('Erro no auto play:', error);
      return false;
    }
  }, [gameId]);

  return {
    syncPlayMove,
    syncPassTurn,
    syncAutoPlay
  };
};
