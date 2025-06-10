
import React, { useState } from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useMobile';

interface PlayerHandProps {
  playerPieces: DominoPieceType[];
  onPieceDrag: (piece: DominoPieceType) => void;
  onPiecePlay: (piece: DominoPieceType) => void;
  isCurrentPlayer: boolean;
  playerName: string;
  timeLeft?: number;
  onAutoPlay?: () => void;
  isProcessingMove?: boolean;
  canPiecePlay?: (piece: DominoPieceType) => boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  playerPieces,
  onPieceDrag,
  onPiecePlay,
  isCurrentPlayer,
  playerName,
  timeLeft = 30,
  onAutoPlay,
  isProcessingMove = false,
  canPiecePlay
}) => {
  const [draggedPiece, setDraggedPiece] = useState<DominoPieceType | null>(null);
  const isMobile = useIsMobile();

  const handleDragStart = (piece: DominoPieceType) => (e: React.DragEvent) => {
    if (!isCurrentPlayer || isProcessingMove) {
      e.preventDefault();
      return;
    }

    const isPiecePlayable = canPiecePlay ? canPiecePlay(piece) : true;
    if (!isPiecePlayable) {
      e.preventDefault();
      return;
    }

    setDraggedPiece(piece);
    onPieceDrag(piece);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', piece.id);
    e.dataTransfer.setData('application/json', JSON.stringify(piece));
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
  };

  const handlePieceClick = (piece: DominoPieceType) => {
    if (!isCurrentPlayer || isProcessingMove) return;
    
    const isPiecePlayable = canPiecePlay ? canPiecePlay(piece) : true;
    if (isPiecePlayable) {
      onPiecePlay(piece);
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-r from-purple-900/50 to-black/50 rounded-2xl border-2 transition-all duration-300 w-full max-w-6xl mx-auto",
      isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/30",
      isMobile ? "p-2" : "p-4"
    )}>
      <div className={cn(
        "flex items-center justify-between",
        isMobile ? "mb-2" : "mb-4"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-full",
            isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500",
            isMobile ? "w-2 h-2" : "w-4 h-4"
          )} />
          <h3 className={cn(
            "font-semibold",
            isCurrentPlayer ? "text-yellow-400" : "text-purple-200",
            isMobile ? "text-sm" : "text-lg"
          )}>
            {playerName} {isCurrentPlayer && "(Sua vez)"}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {isCurrentPlayer && onAutoPlay && !isMobile && (
            <Button 
              onClick={onAutoPlay}
              disabled={isProcessingMove}
              size="sm"
              variant="outline"
              className="bg-yellow-400/10 border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/20"
            >
              {isProcessingMove ? 'Processando...' : 'Auto Play'}
            </Button>
          )}
          
          {isCurrentPlayer && (
            <div className={cn(
              "font-mono px-3 py-1 rounded-full",
              timeLeft <= 3 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-400 text-black",
              isMobile ? "text-xs" : "text-sm"
            )}>
              {timeLeft}s
            </div>
          )}
        </div>
      </div>

      {/* Layout das peças adaptado para mobile landscape */}
      <div className={cn(
        "justify-items-center",
        isMobile ? "grid grid-cols-7 gap-1" : "grid grid-cols-7 gap-2"
      )}>
        {playerPieces.map((piece) => {
          const isPiecePlayable = canPiecePlay ? canPiecePlay(piece) : true;
          
          return (
            <div key={piece.id} className="flex justify-center">
              <DominoPiece
                topValue={piece.top}
                bottomValue={piece.bottom}
                isDragging={draggedPiece?.id === piece.id}
                isPlayable={isCurrentPlayer && isPiecePlayable && !isProcessingMove}
                onDragStart={handleDragStart(piece)}
                onDragEnd={handleDragEnd}
                onClick={() => handlePieceClick(piece)}
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  !isCurrentPlayer && "grayscale",
                  isCurrentPlayer && !isPiecePlayable && "opacity-50 cursor-not-allowed",
                  isCurrentPlayer && isPiecePlayable && "hover:ring-2 hover:ring-yellow-400",
                  isMobile ? "w-6 h-12" : "w-8 h-16"
                )}
              />
            </div>
          );
        })}
      </div>

      {!isMobile && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-purple-300">
            {playerPieces.length} peças restantes
          </div>
          
          {isCurrentPlayer && canPiecePlay && (
            <div className="text-xs text-yellow-400">
              {playerPieces.filter(piece => canPiecePlay(piece)).length} peças jogáveis
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlayerHand;
