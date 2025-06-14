
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DominoPieceType } from '@/types/game';
import { validateMove, toBackendFormat, standardizePiece } from '@/utils/pieceValidation';

interface UseOptimizedGameLogicProps {
  gameId: string;
  userId: string | undefined;
  currentPlayerTurn: string | null;
  boardState: any;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export const useOptimizedGameLogic = ({ 
  gameId, 
  userId, 
  currentPlayerTurn, 
  boardState 
}: UseOptimizedGameLogicProps) => {
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Memoizar validação de turno
  const isMyTurn = useMemo(() => 
    currentPlayerTurn === userId, 
    [currentPlayerTurn, userId]
  );

  // Função de retry com backoff exponencial
  const executeWithRetry = useCallback(async (
    operation: () => Promise<any>,
    operationName: string
  ): Promise<boolean> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await operation();
        setRetryCount(0);
        return true;
      } catch (error: any) {
        console.error(`${operationName} - Tentativa ${attempt + 1} falhou:`, error);
        
        if (attempt === MAX_RETRIES) {
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            toast.error('Erro de conexão. Verifique sua internet.');
          } else {
            toast.error(`Erro após ${MAX_RETRIES} tentativas: ${error.message}`);
          }
          return false;
        }
        
        // Backoff exponencial
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        setRetryCount(attempt + 1);
      }
    }
    return false;
  }, []);

  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    console.log('useOptimizedGameLogic: Tentando jogar peça:', piece);
    
    if (isProcessingMove) {
      toast.error('Aguarde, processando jogada anterior.');
      return false;
    }
    
    if (!userId || !isMyTurn) {
      toast.error('Não é sua vez de jogar.');
      return false;
    }

    // Validação otimizada
    let validation;
    try {
      validation = validateMove(piece, boardState);
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro na validação da jogada');
      return false;
    }
    
    if (!validation.isValid) {
      toast.error(validation.error || 'Jogada inválida');
      return false;
    }

    setIsProcessingMove(true);
    setCurrentAction('playing');
    
    const playOperation = async () => {
      const pieceForRPC = piece.originalFormat || toBackendFormat(standardizePiece(piece));
      
      const { error } = await supabase.rpc('play_move', {
        p_game_id: gameId,
        p_piece: pieceForRPC,
        p_side: validation.side
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast.success('Jogada realizada com sucesso!');
    };

    const success = await executeWithRetry(playOperation, 'Jogar peça');
    
    setIsProcessingMove(false);
    setCurrentAction(null);
    return success;
  }, [isProcessingMove, userId, isMyTurn, gameId, boardState, executeWithRetry]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove || !isMyTurn) return false;
    
    setIsProcessingMove(true);
    setCurrentAction('passing');
    
    const passOperation = async () => {
      const { error } = await supabase.rpc('pass_turn', {
        p_game_id: gameId
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast.info('Você passou a vez.');
    };

    const success = await executeWithRetry(passOperation, 'Passar a vez');
    
    setIsProcessingMove(false);
    setCurrentAction(null);
    return success;
  }, [gameId, isProcessingMove, isMyTurn, executeWithRetry]);

  const playAutomatic = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove || !isMyTurn) return false;
    
    setIsProcessingMove(true);
    setCurrentAction('auto_playing');
    
    const autoPlayOperation = async () => {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameId,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast.success('Jogada automática realizada!');
    };

    const success = await executeWithRetry(autoPlayOperation, 'Jogo automático');
    
    setIsProcessingMove(false);
    setCurrentAction(null);
    return success;
  }, [gameId, isProcessingMove, isMyTurn, executeWithRetry]);

  return {
    playPiece,
    passTurn,
    playAutomatic,
    isProcessingMove,
    currentAction,
    retryCount,
    isMyTurn
  };
};
