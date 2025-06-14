
import React from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/types/game';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  className?: string;
}

const GameBoard: React.FC<GameBoardProps> = ({
  placedPieces,
  onDrop,
  onDragOver,
  className
}) => {
  const handleDrop = (e: React.DragEvent) => {
    console.log('Board drop event triggered');
    e.preventDefault();
    onDrop(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e);
  };

  return (
    <div className={cn("flex justify-center", className)}>
      <div className={cn("w-full max-w-4xl min-h-[250px] bg-gradient-to-br from-green-800/30 to-green-900/30 rounded-3xl border-4 border-green-600/30 backdrop-blur-sm")}>
        <div className="h-full p-6 py-[30px]">
          <div 
            className={cn(
              "w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300",
              "flex items-center justify-center flex-col gap-2 p-4 overflow-auto min-h-[200px]",
              placedPieces.length === 0 ? "border-yellow-400/50 bg-yellow-400/5" : "border-green-400/50"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            data-testid="game-board"
          >
            {placedPieces.length === 0 ? (
              <div className="text-center text-green-200">
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-lg font-semibold">Arraste a primeira peça aqui</p>
                <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
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
                        className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-red-400 rounded-full animate-pulse" 
                        title="Extremidade esquerda" 
                      />
                    )}
                    {index === placedPieces.length - 1 && (
                      <div 
                        className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full animate-pulse" 
                        title="Extremidade direita" 
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
