
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
      // Usa peça já padronizada e converte para formato do backend
      const pieceForRPC = piece.originalFormat || toBackendFormat({ top: piece.top, bottom: piece.bottom });
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
      return true;
    } catch (error) {
      console.error('Erro na sincronização de jogada:', error);
      return false;
    }
  }, [gameId, boardState]);

  const syncPassTurn = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('pass_turn', {
        p_game_id: gameId
      });

      if (error) {
        console.error('Erro RPC pass_turn:', error);
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Erro na sincronização de passe:', error);
      return false;
    }
  }, [gameId]);

  const syncAutoPlay = useCallback(async () => {
    try {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameId,
      });
      
      if (error) {
        console.error('Erro RPC auto_play:', error);
        throw error;
      }
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
