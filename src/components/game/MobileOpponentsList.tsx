
import React from 'react';
import { ProcessedPlayer } from '@/types/game';

interface MobileOpponentsListProps {
  opponents: ProcessedPlayer[];
}

const MobileOpponentsList: React.FC<MobileOpponentsListProps> = ({
  opponents
}) => {
  return (
    <div className="flex-shrink-0 p-2">
      <div className="grid grid-cols-3 gap-2">
        {opponents.slice(0, 3).map((opponent) => (
          <div key={opponent.id} className="bg-purple-900/50 rounded-lg p-2 text-center">
            <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${opponent.isCurrentPlayer ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500'}`} />
            <p className="text-xs text-purple-200 truncate">{opponent.name}</p>
            <p className="text-xs text-purple-300">{opponent.pieces.length} peças</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileOpponentsList;
