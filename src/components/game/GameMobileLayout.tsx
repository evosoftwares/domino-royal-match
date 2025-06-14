
import React from 'react';
import { ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from '../GameBoard';
import PlayerHand from '../PlayerHand';
import MobileOpponentsList from './MobileOpponentsList';
import VisualGameTimer from '../VisualGameTimer';

interface GameMobileLayoutProps {
  opponents: ProcessedPlayer[];
  placedPieces: DominoPieceType[];
  currentUserPlayer: ProcessedPlayer | undefined;
  gameHandlers: {
    handleDrop: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent) => void;
    handleAutoPlay: () => void;
    handlePassClick: () => void;
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

      {/* Timer Visual Mobile */}
      <div className="flex-shrink-0 p-2">
        <VisualGameTimer
          timeLeft={timeLeft}
          isMyTurn={currentUserPlayer?.isCurrentPlayer || false}
          isWarning={isWarning}
          onAutoPlay={gameHandlers.handleAutoPlay}
          className="w-full"
        />
      </div>

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
            onPiecePlay={playPiece}
            isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
            playerName={currentUserPlayer.name}
            isProcessingMove={isProcessingMove}
            canPiecePlay={gameHandlers.canPiecePlay}
            onAutoPlay={gameHandlers.handleAutoPlay}
            onPassTurn={gameHandlers.handlePassClick}
            timeLeft={timeLeft}
            isWarning={isWarning}
          />
        )}
      </div>
    </div>
  );
};

export default GameMobileLayout;
