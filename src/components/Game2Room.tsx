import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OptimizedOpponentsList from './OptimizedOpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useOptimizedGameLogic } from '@/hooks/useOptimizedGameLogic';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { 
  standardizePiece, 
  extractBoardEnds,
  canPieceConnect 
} from '@/utils/pieceValidation';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';

interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const Game2Room: React.FC<Game2RoomProps> = ({
  gameData: initialGameData,
  players: initialPlayers,
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [gameState, setGameState] = useState(initialGameData);
  const [playersState, setPlayersState] = useState(initialPlayers);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);

  const { 
    playPiece, 
    passTurn, 
    isProcessingMove, 
    currentAction,
    isMyTurn
  } = useOptimizedGameLogic({
    gameId: gameState.id,
    userId: user?.id,
    currentPlayerTurn: gameState.current_player_turn,
    boardState: gameState.board_state
  });

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  const processedPlayers: ProcessedPlayer[] = playersState.map((player): ProcessedPlayer => {
    const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) 
      ? player.hand.map((piece: any, index: number): DominoPieceType | null => {
          if (piece && typeof piece === 'object' && 'l' in piece && 'r' in piece) {
            return {
              id: `${player.user_id}-piece-${index}`,
              top: piece.l,
              bottom: piece.r,
              originalFormat: piece
            };
          }
          return null;
        }).filter((p): p is DominoPieceType => p !== null)
      : [];

    return {
      id: player.user_id,
      name: player.profiles?.full_name || `Jogador ${player.position}`,
      pieces,
      isCurrentPlayer: gameState.current_player_turn === player.user_id,
      position: player.position,
      originalData: player
    };
  });

  const currentUserPlayer = processedPlayers.find(p => p.id === user?.id);
  const opponents = processedPlayers.filter(p => p.id !== user?.id);

  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => {
      let piece;
      if (boardPiece.piece && Array.isArray(boardPiece.piece)) {
        piece = boardPiece.piece;
      } else if (Array.isArray(boardPiece)) {
        piece = boardPiece;
      } else if (boardPiece && typeof boardPiece === 'object' && typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
        piece = [boardPiece.l, boardPiece.r];
      } else {
        return null;
      }

      return {
        id: `board-piece-${index}`,
        top: piece[0],
        bottom: piece[1]
      };
    }).filter((p): p is DominoPieceType => p !== null);
  }

  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const standardPiece = standardizePiece(piece);
      const boardEnds = extractBoardEnds(gameState.board_state);
      const result = canPieceConnect(standardPiece, boardEnds);
      
      return result;
    } catch (error) {
      console.error('Erro ao verificar jogabilidade da peça:', error);
      return false;
    }
  }, [gameState.board_state]);

  const handleAutoPlay = useCallback(() => {
    if (!currentUserPlayer || !isMyTurn || isProcessingMove) return;

    const playablePieces = currentUserPlayer.pieces.filter(canPiecePlay);
    if (playablePieces.length > 0) {
      // IA simples: joga a primeira peça válida
      const pieceToPlay = playablePieces[0];
      toast.info(`Jogando peça automaticamente: [${pieceToPlay.top}|${pieceToPlay.bottom}]`);
      playPiece(pieceToPlay);
    } else {
      toast.info('Nenhuma peça jogável, passando a vez automaticamente.');
      passTurn();
    }
  }, [currentUserPlayer, isMyTurn, isProcessingMove, canPiecePlay, playPiece, passTurn]);

  const { timeLeft, isWarning } = useOptimizedGameTimer({
    isMyTurn: isMyTurn,
    onTimeout: handleAutoPlay,
    isGameActive: gameState.status === 'active',
  });

  const handlePieceDrag = (piece: DominoPieceType) => {
    console.log('Iniciando drag da peça:', piece);
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop detectado');
    
    if (currentDraggedPiece && currentUserPlayer?.isCurrentPlayer && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  const winState = useGameWinCheck({
    players: processedPlayers,
    gameStatus: gameState.status
  });

  if (gameState.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <div className="text-center p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Aguardando início do jogo...</h2>
          <p className="text-purple-200">Status: {gameState.status}</p>
          <p className="text-purple-200 mt-2">Jogadores conectados: {playersState.length}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black overflow-hidden">
      <GamePlayersHeader gameId={gameState.id} />
      
      <ActionFeedback 
        isProcessing={isProcessingMove}
        action={currentAction}
      />
      
      <WinnerDialog 
        winner={winState.winner}
        winType={winState.winType}
        isVisible={winState.hasWinner}
        currentUserId={user?.id}
      />
      
      {isMobile ? (
        <div className="h-screen flex flex-col relative">
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

          <div className="flex-1 flex items-center justify-center p-2">
            <GameBoard 
              placedPieces={placedPieces} 
              onDrop={handleDrop} 
              onDragOver={handleDragOver} 
              className="w-full h-full max-h-[200px]" 
            />
          </div>

          <div className="flex-shrink-0 p-2">
            {currentUserPlayer && (
              <PlayerHand 
                playerPieces={currentUserPlayer.pieces}
                onPieceDrag={handlePieceDrag}
                onPiecePlay={playPiece}
                isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
                playerName={currentUserPlayer.name}
                isProcessingMove={isProcessingMove}
                canPiecePlay={canPiecePlay}
                onAutoPlay={handleAutoPlay}
                timeLeft={timeLeft}
                isWarning={isWarning}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          <div className="flex-shrink-0 p-4">
            <OptimizedOpponentsList opponents={opponents} />
          </div>
          <div className="flex-1 flex items-center justify-center p-4 px-0 py-[56px] my-0">
            <GameBoard 
              placedPieces={placedPieces} 
              onDrop={handleDrop} 
              onDragOver={handleDragOver} 
              className="w-full max-w-4xl" 
            />
          </div>
          <div className="flex-shrink-0 p-4 flex items-center justify-between">
            <div className="flex-1">
              {currentUserPlayer && (
                <PlayerHand 
                  playerPieces={currentUserPlayer.pieces}
                  onPieceDrag={handlePieceDrag}
                  onPiecePlay={playPiece}
                  isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
                  playerName={currentUserPlayer.name}
                  isProcessingMove={isProcessingMove}
                  canPiecePlay={canPiecePlay}
                  onAutoPlay={handleAutoPlay}
                  timeLeft={timeLeft}
                  isWarning={isWarning}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Game2Room);
