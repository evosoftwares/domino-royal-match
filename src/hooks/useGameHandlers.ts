
import { useCallback } from 'react';
import { DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { gameCache, createPieceValidationKey } from '@/utils/gameCache';
import { canPieceConnect, extractBoardEnds } from '@/utils/standardPieceValidation';

interface UseGameHandlersProps {
  gameState: any;
  currentUserPlayer: any;
  isMyTurn: boolean;
  isProcessingMove: boolean;
  playPiece: (piece: DominoPieceType) => void;
  passTurn: () => void;
  playAutomatic?: () => void;
}

export const useGameHandlers = ({
  gameState,
  currentUserPlayer,
  isMyTurn,
  isProcessingMove,
  playPiece,
  passTurn,
  playAutomatic
}: UseGameHandlersProps) => {
  // Verificação otimizada se peça pode jogar usando cache centralizado
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const boardEnds = extractBoardEnds(gameState.board_state);
      const boardHash = `${boardEnds.left || 'null'}-${boardEnds.right || 'null'}`;
      const cacheKey = createPieceValidationKey(piece, boardHash);
      
      // Verificar cache primeiro
      const cached = gameCache.getPieceValidation(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Calcular e armazenar no cache
      const result = canPieceConnect({ top: piece.top, bottom: piece.bottom }, boardEnds);
      gameCache.setPieceValidation(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Erro ao verificar jogabilidade da peça:', error);
      return false;
    }
  }, [gameState.board_state]);

  const handlePassClick = useCallback(() => {
    if (!isMyTurn || isProcessingMove || !currentUserPlayer) return;
    
    const hasPlayablePiece = currentUserPlayer.pieces.some(canPiecePlay);

    if (hasPlayablePiece) {
      toast.error("Você tem peças jogáveis e não pode passar a vez.");
      return;
    }
    
    passTurn();
  }, [isMyTurn, isProcessingMove, currentUserPlayer, canPiecePlay, passTurn]);

  const handleAutoPlay = useCallback(() => {
    if (!currentUserPlayer || !isMyTurn || isProcessingMove) return;

    const playablePieces = currentUserPlayer.pieces.filter(canPiecePlay);
    if (playablePieces.length > 0) {
      const pieceToPlay = playablePieces[0];
      toast.info(`Jogando peça automaticamente: [${pieceToPlay.top}|${pieceToPlay.bottom}]`);
      playPiece(pieceToPlay);
    } else {
      toast.info('Nenhuma peça jogável, passando a vez automaticamente.');
      if (playAutomatic) {
        playAutomatic();
      } else {
        passTurn();
      }
    }
  }, [currentUserPlayer, isMyTurn, isProcessingMove, canPiecePlay, playPiece, passTurn, playAutomatic]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!isMyTurn || isProcessingMove) {
      toast.warning("Aguarde, processando jogada anterior ou não é sua vez.");
      return;
    }

    try {
      const pieceJSON = e.dataTransfer.getData('application/json');
      if (!pieceJSON) {
        console.warn('Dropped item has no "application/json" data.');
        return;
      }
      
      const piece = JSON.parse(pieceJSON) as DominoPieceType;
      
      if (!piece || typeof piece.top !== 'number' || typeof piece.bottom !== 'number' || !piece.id) {
          toast.error("Dados da peça inválidos ou corrompidos.");
          return;
      }
      
      playPiece(piece);

    } catch (error) {
      console.error('Erro ao processar o drop da peça:', error);
      toast.error('Ocorreu um erro ao soltar a peça.');
    }
  }, [isMyTurn, isProcessingMove, playPiece]);

  return {
    canPiecePlay,
    handleAutoPlay,
    handleDragOver,
    handleDrop,
    handlePassClick,
  };
};
