import React from 'react';
import { cn } from '@/lib/utils';
import DominoPiece from './DominoPiece';

interface PlayerData {
  id: string;
  name: string;
  pieces: any[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: any;
}

interface OpponentAreaProps {
  player: PlayerData;
  isCurrentPlayer: boolean;
  pieceCount: number;
}

const OpponentArea: React.FC<OpponentAreaProps> = ({ 
  player, 
  isCurrentPlayer, 
  pieceCount 
}) => {
  return (
    <div className={cn(
      "bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border transition-all duration-300",
      isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/20"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full transition-colors",
            isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
          )} />
          <div>
            <span className={cn(
              "text-sm font-medium",
              isCurrentPlayer ? "text-yellow-400" : "text-purple-200"
            )}>
              {player.name}
            </span>
            {isCurrentPlayer && (
              <div className="text-xs text-green-400 font-semibold">Jogando...</div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.min(pieceCount, 7) }).map((_, index) => (
            <DominoPiece
              key={index}
              topValue={0}
              bottomValue={0}
              orientation="horizontal"
              isPlayable={false}
              className="w-8 h-4 opacity-50"
            />
          ))}
          {pieceCount > 7 && (
            <span className="text-xs text-purple-300">+{pieceCount - 7}</span>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs text-purple-300 text-right">{pieceCount} peças restantes</div>
    </div>
  );
};

export default OpponentArea;
