import React from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  className?: string;
}

const GameBoard: React.FC<GameBoardProps> = ({
  placedPieces,
  onDrop,
  onDragOver,
  className
}) => {
  // Debug: mostrar informações das peças
  console.log('GameBoard placedPieces:', placedPieces);

  const handleDrop = (e: React.DragEvent) => {
    console.log('Board drop event triggered');
    e.preventDefault();
    onDrop?.(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.(e);
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
            onDrop={onDrop ? handleDrop : undefined}
            onDragOver={onDragOver ? handleDragOver : undefined}
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
                {placedPieces.map((piece, index) => {
                  console.log(`Renderizando peça ${index}:`, piece);
                  const topValue = piece.top ?? 0;
                  const bottomValue = piece.bottom ?? 0;
                  
                  return (
                    <div key={`${piece.id}-${index}`} className="relative">
                      <DominoPiece 
                        topValue={topValue} 
                        bottomValue={bottomValue} 
                        isPlayable={false} 
                        className="shadow-xl" 
                        orientation="horizontal" 
                      />
                      {index === 0 && (
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Extremidade superior" />
                      )}
                      {index === placedPieces.length - 1 && (
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Extremidade inferior" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;