
import React from 'react';
import { ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from '../GameBoard';
import PlayerHand from '../PlayerHand';
import MobileOpponentsList from './MobileOpponentsList';

interface GameMobileLayoutProps {
  opponents: ProcessedPlayer[];
  placedPieces: DominoPieceType[];
  currentUserPlayer: ProcessedPlayer | undefined;
  gameHandlers: {
    handleDrop: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent) => void;
    handlePieceDrag: (piece: DominoPieceType) => void;
    handleAutoPlay: () => void;
    canPiecePlay: (piece: DominoPieceType) => boolean;
  };
  playPiece: (piece: DominoPieceType) => void;
  isProcessingMove: boolean;
  timeLeft: number;
  isWarning: boolean;
}

const GameMobileLayout: React.FC<GameMobileLayoutProps> = ({
  opponents,
  placedPieces,
  currentUserPlayer,
  gameHandlers,
  playPiece,
  isProcessingMove,
  timeLeft,
  isWarning
}) => {
  return (
    <div className="h-screen flex flex-col relative">
      <MobileOpponentsList opponents={opponents} />

      <div className="flex-1 flex items-center justify-center p-2">
        <GameBoard 
          placedPieces={placedPieces} 
          onDrop={gameHandlers.handleDrop} 
          onDragOver={gameHandlers.handleDragOver} 
          className="w-full h-full max-h-[200px]" 
        />
      </div>

      <div className="flex-shrink-0 p-2">
        {currentUserPlayer && (
          <PlayerHand 
            playerPieces={currentUserPlayer.pieces}
            onPieceDrag={gameHandlers.handlePieceDrag}
            onPiecePlay={playPiece}
            isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
            playerName={currentUserPlayer.name}
            isProcessingMove={isProcessingMove}
            canPiecePlay={gameHandlers.canPiecePlay}
            onAutoPlay={gameHandlers.handleAutoPlay}
            timeLeft={timeLeft}
            isWarning={isWarning}
          />
        )}
      </div>
    </div>
  );
};

export default GameMobileLayout;
