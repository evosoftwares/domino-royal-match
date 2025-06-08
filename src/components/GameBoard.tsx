
import React from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
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
  return (
    <div className={cn(
      "w-full max-w-4xl min-h-[300px] bg-gradient-to-br from-green-800/30 to-green-900/30 rounded-3xl border-4 border-green-600/30 backdrop-blur-sm",
      className
    )}>
      <div className="h-full p-8">
        <div
          className={cn(
            "w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300",
            "flex items-center justify-center flex-col gap-2 p-4 overflow-auto",
            placedPieces.length === 0 ? "border-yellow-400/50 bg-yellow-400/5" : "border-green-400/50"
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
          data-testid="game-board"
        >
          {placedPieces.length === 0 ? (
            <div className="text-center text-green-200">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-xl font-semibold">Arraste a primeira peça aqui</p>
              <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 max-w-full">
              {placedPieces.map((piece, index) => (
                <div
                  key={`${piece.id}-${index}`}
                  className="relative"
                >
                  <DominoPiece
                    topValue={piece.top}
                    bottomValue={piece.bottom}
                    isPlayable={false}
                    className="shadow-2xl transform rotate-90"
                  />
                  {/* Indicadores das extremidades */}
                  {index === 0 && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse" 
                         title="Extremidade superior" />
                  )}
                  {index === placedPieces.length - 1 && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse"
                         title="Extremidade inferior" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
