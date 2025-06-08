import React from 'react';
import { ProcessedPlayer } from '@/types/game';
import { cn } from '@/lib/utils';
import DominoPiece from './DominoPiece';

interface OpponentsListProps {
  opponents: ProcessedPlayer[];
}

const OpponentsList: React.FC<OpponentsListProps> = ({ opponents }) => {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-6xl mx-auto">
      {opponents.slice(0, 3).map(player => (
        <div
          key={player.id}
          className={cn(
            "bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border transition-all duration-300",
            player.isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/20"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full transition-colors",
                player.isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
              )} />
              <span className={cn(
                "text-sm font-medium",
                player.isCurrentPlayer ? "text-yellow-400" : "text-purple-200"
              )}>
                {player.name}
              </span>
            </div>
            {player.isCurrentPlayer && (
              <div className="text-xs text-green-400 font-semibold">Jogando...</div>
            )}
          </div>
          
          <div className="flex items-center gap-1 flex-wrap justify-center">
            {Array.from({ length: Math.min(player.pieces.length, 8) }).map((_, index) => (
              <DominoPiece
                key={index}
                topValue={0}
                bottomValue={0}
                orientation="horizontal"
                isPlayable={false}
                className="w-6 h-6 opacity-50"
              />
            ))}
            {player.pieces.length > 8 && (
              <span className="text-xs text-purple-300">+{player.pieces.length - 8}</span>
            )}
          </div>
          
          <div className="mt-2 text-xs text-purple-300 text-center">
            {player.pieces.length} peças
          </div>
        </div>
      ))}
    </div>
  );
};

export default OpponentsList;
