
import { useState, useCallback } from 'react';
import { DominoPieceType } from '@/types/game';
import { 
  standardizePiece, 
  extractBoardEnds,
  canPieceConnect 
} from '@/utils/pieceValidation';
import { toast } from 'sonner';

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
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);

  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const standardPiece = standardizePiece(piece);
      const boardEnds = extractBoardEnds(gameState.board_state);
      const result = canPieceConnect(standardPiece, boardEnds);
      
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

  const handlePieceDrag = (piece: DominoPieceType) => {
    console.log('Iniciando drag da peça:', piece);
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop detectado');
    
    if (currentDraggedPiece && isMyTurn && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  return {
    canPiecePlay,
    handleAutoPlay,
    handlePieceDrag,
    handleDragOver,
    handleDrop,
    handlePassClick, // Exporta o novo manipulador para a UI
  };
};
