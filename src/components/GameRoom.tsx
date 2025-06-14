
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import OpponentsDisplay, { ProcessedPlayer } from './OpponentsDisplay';
import { cn } from '@/lib/utils';
import { GameData, PlayerData } from '@/types/game';

interface GameRoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const GameRoom: React.FC<GameRoomProps> = ({ gameData: initialGameData, players: initialPlayers }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState(initialGameData);
  const [playersState, setPlayersState] = useState(initialPlayers);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  useEffect(() => {
    if (gameState.status !== 'active') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (gameState.current_player_turn === user?.id && !isProcessingMove) {
            handleForceAutoPlay();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.current_player_turn, gameState.status, user?.id, isProcessingMove]);

  useEffect(() => {
    setTimeLeft(15);
  }, [gameState.current_player_turn]);

  const processedPlayers: ProcessedPlayer[] = playersState.map((player): ProcessedPlayer => {
    const pieces: DominoPieceType[] = (player.hand && Array.isArray(player.hand))
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

  const userPlayer = processedPlayers.find(p => p.id === user?.id);
  const otherPlayers = processedPlayers.filter(p => p.id !== user?.id);

  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => {
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
    }).filter((p): p is DominoPieceType => p !== null);
  }

  const isFirstMove = placedPieces.length === 0;

  const getOpenEnds = useCallback(() => {
    if (isFirstMove) return { left: null, right: null };
    return {
      left: gameState.board_state?.left_end || null,
      right: gameState.board_state?.right_end || null
    };
  }, [isFirstMove, gameState.board_state]);

  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    if (isFirstMove) return true;
    const { left, right } = getOpenEnds();
    if (left === null && right === null) return false;
    return piece.top === left || piece.bottom === left || piece.top === right || piece.bottom === right;
  }, [isFirstMove, getOpenEnds]);

  const determineSide = useCallback((piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left';
    const { left, right } = getOpenEnds();
    if ((piece.top === left || piece.bottom === left) && left !== null) return 'left';
    if ((piece.top === right || piece.bottom === right) && right !== null) return 'right';
    return null;
  }, [isFirstMove, getOpenEnds]);

  const handlePieceDrag = (piece: DominoPieceType) => {
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece && userPlayer?.isCurrentPlayer && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  const playPiece = useCallback(async (piece: DominoPieceType) => {
    if (isProcessingMove) {
      toast.error('Aguarde, processando jogada anterior.');
      return;
    }
    if (!user || gameState.current_player_turn !== user.id) {
      toast.error('Não é a sua vez de jogar.');
      return;
    }
    if (!canPiecePlay(piece)) {
      toast.error('Essa peça não pode ser jogada.');
      return;
    }
    const side = determineSide(piece);
    if (!side) {
      toast.error('Não foi possível determinar o lado da jogada.');
      return;
    }

    setIsProcessingMove(true);
    try {
      const pieceForRPC = (piece as any).originalFormat || { l: piece.top, r: piece.bottom };
      const { error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceForRPC,
        p_side: side
      });

      if (error) {
        toast.error(`Erro ao jogar: ${error.message}`);
      } else {
        toast.success('Jogada realizada!');
      }
    } catch (e: any) {
      toast.error('Ocorreu um erro inesperado ao jogar.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [isProcessingMove, user, gameState.id, gameState.current_player_turn, canPiecePlay, determineSide]);

  const handlePassTurn = useCallback(async () => {
    if (isProcessingMove) return;
    setIsProcessingMove(true);
    try {
      const { error } = await supabase.rpc('pass_turn', { p_game_id: gameState.id });
      if (error) {
        toast.error(`Erro ao passar a vez: ${error.message}`);
      } else {
        toast.info('Você passou a vez.');
      }
    } catch (e: any) {
      toast.error('Erro inesperado ao passar a vez.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);

  const handleForceAutoPlay = useCallback(() => {
    const playablePieces = userPlayer?.pieces.filter(canPiecePlay) || [];
    if (playablePieces.length > 0) {
      playPiece(playablePieces[0]);
    } else {
      handlePassTurn();
    }
  }, [userPlayer, canPiecePlay, playPiece, handlePassTurn]);

  const handleManualAutoPlay = () => {
    const playablePieces = userPlayer?.pieces.filter(canPiecePlay);
    if (!playablePieces || playablePieces.length === 0) {
      toast.info('Nenhuma peça jogável, passando a vez.');
      handlePassTurn();
      return;
    }
    playPiece(playablePieces[0]);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black p-4">
      <div className="max-w-7xl mx-auto">
        <OpponentsDisplay opponents={otherPlayers} />

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
  );
};

export default GameRoom;
