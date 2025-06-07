
import React, { useState } from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
import { cn } from '@/lib/utils';

interface PlayerAreaProps {
  playerPieces: DominoPieceType[];
  onPieceDrag: (piece: DominoPieceType) => void;
  isCurrentPlayer: boolean;
  playerName: string;
  timeLeft?: number;
}

const PlayerArea: React.FC<PlayerAreaProps> = ({
  playerPieces,
  onPieceDrag,
  isCurrentPlayer,
  playerName,
  timeLeft = 10
}) => {
  const [draggedPiece, setDraggedPiece] = useState<DominoPieceType | null>(null);

  const handleDragStart = (piece: DominoPieceType) => (e: React.DragEvent) => {
    if (!isCurrentPlayer) {
      e.preventDefault();
      return;
    }
    setDraggedPiece(piece);
    onPieceDrag(piece);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
  };

  return (
    <div className={cn(
      "bg-gradient-to-r from-purple-900/50 to-black/50 rounded-2xl p-6 border-2 transition-all duration-300",
      isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/30"
    )}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-4 h-4 rounded-full",
            isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
          )} />
          <h3 className={cn(
            "text-lg font-semibold",
            isCurrentPlayer ? "text-yellow-400" : "text-purple-200"
          )}>
            {playerName} {isCurrentPlayer && "(Sua vez)"}
          </h3>
        </div>
        
        {isCurrentPlayer && (
          <div className="flex items-center gap-2">
            <div className={cn(
              "text-sm font-mono px-3 py-1 rounded-full",
              timeLeft <= 3 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-400 text-black"
            )}>
              {timeLeft}s
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-purple-900/20">
        {playerPieces.map((piece) => (
          <div key={piece.id} className="flex-shrink-0">
            <DominoPiece
              topValue={piece.top}
              bottomValue={piece.bottom}
              isDragging={draggedPiece?.id === piece.id}
              isPlayable={isCurrentPlayer}
              onDragStart={handleDragStart(piece)}
              onDragEnd={handleDragEnd}
              className={cn(
                "transition-all duration-200",
                !isCurrentPlayer && "grayscale"
              )}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 text-sm text-purple-300">
        {playerPieces.length} peças restantes
      </div>
    </div>
  );
};

export default PlayerArea;
