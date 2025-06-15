
import React from 'react';
import { DominoPieceType } from '@/types/game';
import { cn } from '@/lib/utils';
import LinearGameBoard from './game/LinearGameBoard';

interface GameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  className?: string;
  useLinearLayout?: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({
  placedPieces,
  onDrop,
  onDragOver,
  className,
  useLinearLayout = true
}) => {
  // Usar o novo layout linear por padrão
  return (
    <LinearGameBoard
      placedPieces={placedPieces}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className={className}
      showControls={true}
      autoScroll="center"
    />
  );
};

export default GameBoard;
