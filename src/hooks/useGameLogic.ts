
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DominoPieceType } from '@/types/game';
import { validateMove, toBackendFormat, standardizePiece } from '@/utils/pieceValidation';

interface UseGameLogicProps {
  gameId: string;
  userId: string | undefined;
  currentPlayerTurn: string | null;
  boardState: any;
}

export const useGameLogic = ({ gameId, userId, currentPlayerTurn, boardState }: UseGameLogicProps) => {
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  const playPiece = useCallback(async (piece: DominoPieceType) => {
    console.log('useGameLogic: Tentando jogar peça:', piece);
    
    if (isProcessingMove) {
      toast.error('Aguarde, processando jogada anterior.');
      return false;
    }
    
    if (!userId || currentPlayerTurn !== userId) {
      toast.error('Não é sua vez de jogar.');
      return false;
    }

    // Validação da jogada
    const validation = validateMove(piece, boardState);
    
    if (!validation.isValid) {
      toast.error(validation.error || 'Jogada inválida');
      return false;
    }

    setIsProcessingMove(true);
    
    try {
      // Preparar peça no formato do backend
      const pieceForRPC = piece.originalFormat || toBackendFormat(standardizePiece(piece));
      
      console.log('useGameLogic: Enviando jogada:', {
        gameId,
        piece: pieceForRPC,
        side: validation.side
      });
      
      const { error } = await supabase.rpc('play_move', {
        p_game_id: gameId,
        p_piece: pieceForRPC,
        p_side: validation.side
      });
      
      if (error) {
        console.error('useGameLogic: Erro ao jogar peça:', error);
        toast.error(`Erro ao jogar: ${error.message}`);
        return false;
      } else {
        console.log('useGameLogic: Jogada realizada com sucesso');
        toast.success('Jogada realizada com sucesso!');
        return true;
      }
    } catch (e: any) {
      console.error('useGameLogic: Erro inesperado ao jogar:', e);
      toast.error('Erro inesperado ao jogar.');
      return false;
    } finally {
      setIsProcessingMove(false);
    }
  }, [isProcessingMove, userId, currentPlayerTurn, gameId, boardState]);

  const passTurn = useCallback(async () => {
    if (isProcessingMove) return false;
    
    console.log('useGameLogic: Passando a vez...');
    setIsProcessingMove(true);
    
    try {
      const { error } = await supabase.rpc('pass_turn', {
        p_game_id: gameId
      });
      
      if (error) {
        console.error('useGameLogic: Erro ao passar a vez:', error);
        toast.error(`Erro ao passar a vez: ${error.message}`);
        return false;
      } else {
        console.log('useGameLogic: Vez passada com sucesso');
        toast.info('Você passou a vez.');
        return true;
      }
    } catch (e: any) {
      console.error('useGameLogic: Erro inesperado ao passar a vez:', e);
      toast.error('Erro inesperado ao passar a vez.');
      return false;
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameId, isProcessingMove]);

  const playAutomatic = useCallback(async () => {
    if (isProcessingMove) return false;
    
    console.log('useGameLogic: Executando auto-play...');
    setIsProcessingMove(true);
    
    try {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameId,
      });
      
      if (error) {
        console.error('useGameLogic: Erro no auto play:', error);
        toast.error(`Erro no jogo automático: ${error.message}`);
        return false;
      } else {
        console.log('useGameLogic: Auto play executado com sucesso');
        toast.success('Jogada automática realizada!');
        return true;
      }
    } catch (e: any) {
      console.error('useGameLogic: Erro inesperado no auto play:', e);
      toast.error('Erro inesperado no jogo automático.');
      return false;
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameId, isProcessingMove]);

  return {
    playPiece,
    passTurn,
    playAutomatic,
    isProcessingMove
  };
};
