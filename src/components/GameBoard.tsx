import React from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
import { cn } from '@/lib/utils';
import { useDroppable } from '@dnd-kit/core';

interface GameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop?: (piece: DominoPieceType) => void;
  className?: string;
  isDropAllowed?: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({
  placedPieces,
  onDrop,
  className,
  isDropAllowed = true
}) => {
  const {
    isOver,
    setNodeRef
  } = useDroppable({
    id: 'game-board',
    disabled: !isDropAllowed,
    data: {
      type: 'game-board'
    }
  });

  return (
    <div className={cn("flex justify-center", className)}>
      <div className={cn("w-full max-w-4xl min-h-[250px] bg-gradient-to-br from-green-800/30 to-green-900/30 rounded-3xl border-4 border-green-600/30 backdrop-blur-sm")}>
        <div className="h-full p-6 py-[30px]">
          <div 
            ref={setNodeRef}
            className={cn(
              "w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300",
              "flex items-center justify-center flex-col gap-2 p-4 overflow-auto min-h-[200px]",
              placedPieces.length === 0 ? "border-yellow-400/50 bg-yellow-400/5" : "border-green-400/50",
              isOver && isDropAllowed && "border-purple-400 bg-purple-400/10 scale-[1.02]",
              isOver && isDropAllowed && "shadow-lg shadow-purple-400/20"
            )} 
            data-testid="game-board"
            role="application"
            aria-label="Game board for placing domino pieces"
            aria-dropeffect={isDropAllowed ? "move" : "none"}
          >
            {placedPieces.length === 0 ? (
              <div className="text-center text-green-200">
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-lg font-semibold">Arraste a primeira peça aqui</p>
                <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
                {isOver && isDropAllowed && (
                  <p className="text-sm text-purple-300 mt-2 animate-pulse">Solte a peça aqui!</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 max-w-full">
                {placedPieces.map((piece, index) => (
                  <div key={`${piece.id}-${index}`} className="relative">
                    <DominoPiece 
                      topValue={piece.top} 
                      bottomValue={piece.bottom} 
                      isPlayable={false} 
                      className="shadow-xl" 
                      orientation="horizontal" 
                    />
                    {index === 0 && (
                      <div 
                        className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" 
                        title="Extremidade superior"
                        aria-label="Start end of domino chain" 
                      />
                    )}
                    {index === placedPieces.length - 1 && (
                      <div 
                        className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" 
                        title="Extremidade inferior"
                        aria-label="End of domino chain"
                      />
                    )}
                  </div>
                ))}
                {isOver && isDropAllowed && (
                  <div className="ml-2 text-purple-300 animate-pulse text-sm">
                    ✨ Solte aqui
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;