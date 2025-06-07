
import React from 'react';
import DominoPiece from './DominoPiece';
import { DominoPieceType } from '@/utils/dominoUtils';
import { cn } from '@/lib/utils';

interface GameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ placedPieces, onDrop, onDragOver }) => {
  return (
    <div className="flex-1 min-h-[400px] bg-gradient-to-br from-purple-800/20 to-black/20 rounded-3xl border-4 border-purple-600/30 backdrop-blur-sm">
      <div className="h-full p-8">
        <div
          className={cn(
            "w-full h-full rounded-2xl border-2 border-dashed border-purple-400/50 transition-all duration-300",
            "flex items-center justify-center flex-wrap gap-2 p-4 overflow-auto",
            placedPieces.length === 0 && "border-yellow-400/50 bg-yellow-400/5"
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          {placedPieces.length === 0 ? (
            <div className="text-center text-purple-200">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-xl font-semibold">Arraste a primeira peça aqui</p>
              <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 justify-center items-center">
              {placedPieces.map((piece, index) => (
                <DominoPiece
                  key={`${piece.id}-${index}`}
                  topValue={piece.top}
                  bottomValue={piece.bottom}
                  isPlayable={false}
                  className="shadow-2xl"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
