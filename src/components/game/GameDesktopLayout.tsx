
import React from 'react';
import { ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from '../GameBoard';
import PlayerHand from '../PlayerHand';
import OptimizedOpponentsList from '../OptimizedOpponentsList';
import VisualGameTimer from '../VisualGameTimer';

interface GameDesktopLayoutProps {
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

const GameDesktopLayout: React.FC<GameDesktopLayoutProps> = ({
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
    <div className="min-h-screen flex flex-col">
      <div className="flex-shrink-0 p-4">
        <OptimizedOpponentsList opponents={opponents} />
      </div>
      
      {/* Timer Visual Desktop - Centralizado */}
      <div className="flex-shrink-0 px-4 pb-2">
        <div className="flex justify-center">
          <VisualGameTimer
            timeLeft={timeLeft}
            isMyTurn={currentUserPlayer?.isCurrentPlayer || false}
            isWarning={isWarning}
            onAutoPlay={gameHandlers.handleAutoPlay}
            className="max-w-md"
          />
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 px-0 py-[56px] my-0">
        <GameBoard 
          placedPieces={placedPieces} 
          onDrop={gameHandlers.handleDrop} 
          onDragOver={gameHandlers.handleDragOver} 
          className="w-full max-w-4xl" 
        />
      </div>
      <div className="flex-shrink-0 p-4 flex items-center justify-between">
        <div className="flex-1">
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
    </div>
  );
};

export default GameDesktopLayout;
