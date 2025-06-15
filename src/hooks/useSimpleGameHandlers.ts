
import { useCallback } from 'react';
import { DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { canPieceConnect, extractBoardEnds } from '@/utils/standardPieceValidation';

interface UseSimpleGameHandlersProps {
  gameState: any;
  currentUserPlayer: any;
  isMyTurn: boolean;
  isProcessingMove: boolean;
  playPiece: (piece: DominoPieceType) => void;
  passTurn: () => void;
  playAutomatic?: () => void;
}

export const useSimpleGameHandlers = ({
  gameState,
  currentUserPlayer,
  isMyTurn,
  isProcessingMove,
  playPiece,
  passTurn,
  playAutomatic
}: UseSimpleGameHandlersProps) => {
  
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const boardEnds = extractBoardEnds(gameState.board_state);
      return canPieceConnect({ top: piece.top, bottom: piece.bottom }, boardEnds);
    } catch (error) {
      console.error('Erro ao verificar jogabilidade da peça:', error);
      return false;
    }
  }, [gameState.board_state]);

  const handlePassClick = useCallback(() => {
    if (!isMyTurn || isProcessingMove || !currentUserPlayer) return;
    
    const hasPlayablePiece = currentUserPlayer.pieces?.some(canPiecePlay) || false;

    if (hasPlayablePiece) {
      toast.error("Você tem peças jogáveis e não pode passar a vez.");
      return;
    }
    
    console.log('👤 Passando a vez manualmente');
    passTurn();
  }, [isMyTurn, isProcessingMove, currentUserPlayer, canPiecePlay, passTurn]);

  const handleAutoPlay = useCallback(() => {
    if (!isMyTurn || isProcessingMove) {
        toast.warning("Aguarde, não é sua vez ou uma jogada está em processamento.");
        return;
    }
    
    if (playAutomatic) {
      console.log('🤖 Iniciando jogada automática por timeout de 10 segundos');
      toast.info("⏰ Tempo esgotado - executando jogada automática...", {
        duration: 2000
      });
      playAutomatic();
    } else {
      toast.error("Função de jogada automática não disponível no momento.");
    }
  }, [isMyTurn, isProcessingMove, playAutomatic]);

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
      
      console.log('🎯 Jogando peça por drag&drop:', piece);
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
