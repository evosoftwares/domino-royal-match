
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DominoPieceType } from '@/types/game';
import { toBackendFormat } from '@/utils/standardPieceValidation';

interface UseServerSyncProps {
  gameId: string;
  boardState: any;
}

export const useServerSync = ({ gameId, boardState }: UseServerSyncProps) => {
  
  // Sincronizar jogada com servidor
  const syncPlayMove = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    try {
      console.log('🔄 Sincronizando jogada com servidor:', piece);
      
      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameId,
        p_piece: piece.originalFormat || toBackendFormat(piece),
        p_side: 'left' // Será validado no servidor
      });
      
      if (error) {
        console.error('❌ Erro no servidor ao jogar peça:', error);
        return false;
      }
      
      console.log('✅ Jogada sincronizada com sucesso:', data);
      return true;
      
    } catch (error) {
      console.error('❌ Erro de rede ao sincronizar jogada:', error);
      return false;
    }
  }, [gameId]);

  // Sincronizar passe com servidor
  const syncPassTurn = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔄 Sincronizando passe com servidor');
      
      const { data, error } = await supabase.rpc('pass_turn', { 
        p_game_id: gameId 
      });
      
      if (error) {
        console.error('❌ Erro no servidor ao passar turno:', error);
        return false;
      }
      
      console.log('✅ Passe sincronizado com sucesso:', data);
      return true;
      
    } catch (error) {
      console.error('❌ Erro de rede ao sincronizar passe:', error);
      return false;
    }
  }, [gameId]);

  return {
    syncPlayMove,
    syncPassTurn
  };
};
