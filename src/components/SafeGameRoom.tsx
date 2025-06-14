
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import OptimizedOpponentsList from './OptimizedOpponentsList';
import { cn } from '@/lib/utils';
import { GameData, PlayerData } from '@/types/game';
import { useOptimizedGameLogic } from '@/hooks/useOptimizedGameLogic';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { standardizePiece, extractBoardEnds, canPieceConnect } from '@/utils/pieceValidation';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import ErrorBoundary from './ErrorBoundary';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProcessedPlayer } from '@/types/game';

interface SafeGameRoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const SafeGameRoom: React.FC<SafeGameRoomProps> = ({ gameData: initialGameData, players: initialPlayers }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState(initialGameData);
  const [playersState, setPlayersState] = useState(initialPlayers);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);

  // Usar hooks otimizados
  const { 
    playPiece, 
    passTurn, 
    playAutomatic, 
    isProcessingMove, 
    currentAction,
    retryCount,
    isMyTurn 
  } = useOptimizedGameLogic({
    gameId: gameState.id,
    userId: user?.id,
    currentPlayerTurn: gameState.current_player_turn,
    boardState: gameState.board_state
  });

  const { timeLeft, isWarning } = useOptimizedGameTimer({
    isMyTurn: isMyTurn && gameState.status === 'active',
    onTimeout: () => {
      if (!isProcessingMove) {
        handleManualAutoPlay();
      }
    },
    timerDuration: 15,
    isGameActive: gameState.status === 'active'
  });

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  // Memoização otimizada dos jogadores processados
  const processedPlayers: ProcessedPlayer[] = useMemo(() => 
    playersState.map((player): ProcessedPlayer => {
      const pieces: DominoPieceType[] = (player.hand && Array.isArray(player.hand))
        ? player.hand.map((piece: any, index: number): DominoPieceType | null => {
            try {
              if (piece && typeof piece === 'object' && 'l' in piece && 'r' in piece) {
                return {
                  id: `${player.user_id}-piece-${index}`,
                  top: piece.l,
                  bottom: piece.r,
                  originalFormat: piece
                };
              }
              return null;
            } catch (error) {
              console.error('Erro ao processar peça:', error);
              return null;
            }
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
    }), [playersState, gameState.current_player_turn]
  );

  const userPlayer = useMemo(() => 
    processedPlayers.find(p => p.id === user?.id), 
    [processedPlayers, user?.id]
  );
  
  const otherPlayers = useMemo(() => 
    processedPlayers.filter(p => p.id !== user?.id), 
    [processedPlayers, user?.id]
  );

  // Memoização das peças do tabuleiro
  const placedPieces: DominoPieceType[] = useMemo(() => {
    if (!gameState.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      return [];
    }

    return gameState.board_state.pieces.map((boardPiece: any, index: number) => {
      try {
        let piece;
        if (boardPiece.piece && Array.isArray(boardPiece.piece)) {
          piece = boardPiece.piece;
        } else if (Array.isArray(boardPiece)) {
          piece = boardPiece;
        } else if (boardPiece && typeof boardPiece === 'object' && 
                   typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
          piece = [boardPiece.l, boardPiece.r];
        } else {
          return null;
        }

        return {
          id: `board-piece-${index}`,
          top: piece[0],
          bottom: piece[1]
        };
      } catch (error) {
        console.error('Erro ao processar peça do tabuleiro:', error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);
  }, [gameState.board_state]);

  // Validação memoizada
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const standardPiece = standardizePiece(piece);
      const boardEnds = extractBoardEnds(gameState.board_state);
      return canPieceConnect(standardPiece, boardEnds);
    } catch (error) {
      console.error('Erro ao verificar jogabilidade da peça:', error);
      return false;
    }
  }, [gameState.board_state]);

  const handlePieceDrag = useCallback((piece: DominoPieceType) => {
    setCurrentDraggedPiece(piece);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece && userPlayer?.isCurrentPlayer && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  }, [currentDraggedPiece, userPlayer?.isCurrentPlayer, isProcessingMove, playPiece]);

  const handleManualAutoPlay = useCallback(() => {
    try {
      const playablePieces = userPlayer?.pieces.filter(canPiecePlay);
      if (!playablePieces || playablePieces.length === 0) {
        toast.info('Nenhuma peça jogável, passando a vez.');
        passTurn();
        return;
      }
      playAutomatic();
    } catch (error) {
      console.error('Erro no auto play:', error);
      toast.error('Erro no jogo automático');
    }
  }, [userPlayer?.pieces, canPiecePlay, passTurn, playAutomatic]);

  // Verificação de vitória
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
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black p-4">
        <div className="max-w-7xl mx-auto">
          {/* Feedback de ações com retry count */}
          <ActionFeedback 
            isProcessing={isProcessingMove}
            action={currentAction}
          />
          
          {retryCount > 0 && (
            <div className="fixed top-16 right-4 bg-orange-900/90 backdrop-blur-sm rounded-lg p-2 border border-orange-600/50 shadow-lg z-40">
              <p className="text-xs text-orange-200">
                Tentativa {retryCount}/3...
              </p>
            </div>
          )}
          
          {/* Dialog de vitória */}
          <WinnerDialog 
            winner={winState.winner}
            winType={winState.winType}
            isVisible={winState.hasWinner}
            currentUserId={user?.id}
          />

          <OptimizedOpponentsList opponents={otherPlayers} />

          <GameBoard
            placedPieces={placedPieces}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="mb-6"
          />

          {userPlayer && (
            <PlayerArea
              playerPieces={userPlayer.pieces}
              onPieceDrag={handlePieceDrag}
              onPiecePlay={playPiece}
              isCurrentPlayer={userPlayer.isCurrentPlayer}
              playerName={userPlayer.name}
              timeLeft={timeLeft}
              onAutoPlay={handleManualAutoPlay}
              isProcessingMove={isProcessingMove}
              canPiecePlay={canPiecePlay}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default SafeGameRoom;
