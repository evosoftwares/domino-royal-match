import React from 'react';
import OpponentArea from './OpponentArea';
import { PlayerData } from '@/types/game';
import { DominoPieceType } from '@/utils/dominoUtils';

export interface ProcessedPlayer {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: PlayerData;
}

interface OpponentsDisplayProps {
  opponents: ProcessedPlayer[];
}

const OpponentsDisplay: React.FC<OpponentsDisplayProps> = ({ opponents }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {opponents.slice(0, 3).map(player => (
        <OpponentArea
          key={player.id}
          player={player}
          isCurrentPlayer={player.isCurrentPlayer}
          pieceCount={player.pieces.length}
        />
      ))}
    </div>
  );
};

export default OpponentsDisplay; 