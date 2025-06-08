import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}
const Game2Room: React.FC<Game2RoomProps> = ({
  gameData: initialGameData,
  players: initialPlayers
}) => {
  const {
    user
  } = useAuth();
  const isMobile = useIsMobile();
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
    const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) ? player.hand.map((piece: any, index: number): DominoPieceType | null => {
      if (piece && typeof piece === 'object' && 'l' in piece && 'r' in piece) {
        return {
          id: `${player.user_id}-piece-${index}`,
          top: piece.l,
          bottom: piece.r,
          originalFormat: piece
        };
      }
      return null;
    }).filter((p): p is DominoPieceType => p !== null) : [];
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
  const isFirstMove = placedPieces.length === 0;
  const getOpenEnds = useCallback(() => {
    if (isFirstMove) return {
      left: null,
      right: null
    };
    return {
      left: gameState.board_state?.left_end || null,
      right: gameState.board_state?.right_end || null
    };
  }, [isFirstMove, gameState.board_state]);
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    if (isFirstMove) return true;
    const {
      left,
      right
    } = getOpenEnds();
    if (left === null && right === null) return false;
    return piece.top === left || piece.bottom === left || piece.top === right || piece.bottom === right;
  }, [isFirstMove, getOpenEnds]);
  const determineSide = useCallback((piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left';
    const {
      left,
      right
    } = getOpenEnds();
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
    if (currentDraggedPiece && currentUserPlayer?.isCurrentPlayer && !isProcessingMove) {
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
      const pieceForRPC = (piece as any).originalFormat || {
        l: piece.top,
        r: piece.bottom
      };
      const {
        error
      } = await supabase.rpc('play_move', {
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
      const {
        error
      } = await supabase.rpc('pass_turn', {
        p_game_id: gameState.id
      });
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
    const playablePieces = currentUserPlayer?.pieces.filter(canPiecePlay) || [];
    if (playablePieces.length > 0) {
      playPiece(playablePieces[0]);
    } else {
      handlePassTurn();
    }
  }, [currentUserPlayer, canPiecePlay, playPiece, handlePassTurn]);
  const handleManualAutoPlay = () => {
    const playablePieces = currentUserPlayer?.pieces.filter(canPiecePlay);
    if (!playablePieces || playablePieces.length === 0) {
      toast.info('Nenhuma peça jogável, passando a vez.');
      handlePassTurn();
      return;
    }
    playPiece(playablePieces[0]);
  };
  if (gameState.status !== 'active') {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <div className="text-center p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Aguardando início do jogo...</h2>
          <p className="text-purple-200">Status: {gameState.status}</p>
          <p className="text-purple-200 mt-2">Jogadores conectados: {playersState.length}</p>
        </div>
      </div>;
  }

  // Layout responsivo baseado na imagem
  return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black overflow-hidden">
      {/* Header com jogadores - sempre no topo */}
      

      {isMobile ?
    // Layout mobile landscape (similar à imagem)
    <div className="h-screen flex relative">
          {/* Adversário esquerda */}
          <div className="w-24 flex flex-col justify-center items-center p-2">
            {opponents[0] && <div className="bg-gradient-to-b from-purple-900/30 to-black/30 rounded-xl p-2 border border-purple-600/20 transform -rotate-90">
                <div className="text-xs text-purple-200 text-center mb-1">{opponents[0].name}</div>
                <div className="flex gap-0.5 justify-center">
                  {Array.from({
              length: Math.min(opponents[0].pieces.length, 4)
            }).map((_, i) => <div key={i} className="w-2 h-4 bg-gray-600 rounded border border-gray-700"></div>)}
                </div>
                <div className="text-xs text-purple-300 text-center mt-1">{opponents[0].pieces.length}</div>
              </div>}
          </div>

          {/* Área central com mesa e adversários top/bottom */}
          <div className="flex-1 flex flex-col">
            {/* Adversário superior */}
            <div className="h-20 flex justify-center items-center p-2">
              {opponents[1] && <div className="bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-2 border border-purple-600/20">
                  <div className="text-xs text-purple-200 text-center mb-1">{opponents[1].name}</div>
                  <div className="flex gap-0.5 justify-center">
                    {Array.from({
                length: Math.min(opponents[1].pieces.length, 4)
              }).map((_, i) => <div key={i} className="w-3 h-2 bg-gray-600 rounded border border-gray-700"></div>)}
                  </div>
                  <div className="text-xs text-purple-300 text-center mt-1">{opponents[1].pieces.length}</div>
                </div>}
            </div>

            {/* Mesa central */}
            <div className="flex-1 flex items-center justify-center p-2">
              <GameBoard placedPieces={placedPieces} onDrop={handleDrop} onDragOver={handleDragOver} className="w-full h-full max-w-none" />
            </div>

            {/* Mão do jogador na parte inferior */}
            <div className="h-24 p-2">
              {currentUserPlayer && <PlayerHand playerPieces={currentUserPlayer.pieces} onPieceDrag={handlePieceDrag} onPiecePlay={playPiece} isCurrentPlayer={currentUserPlayer.isCurrentPlayer} playerName={currentUserPlayer.name} timeLeft={timeLeft} onAutoPlay={handleManualAutoPlay} isProcessingMove={isProcessingMove} canPiecePlay={canPiecePlay} />}
            </div>
          </div>

          {/* Adversário direita */}
          <div className="w-24 flex flex-col justify-center items-center p-2">
            {opponents[2] && <div className="bg-gradient-to-b from-purple-900/30 to-black/30 rounded-xl p-2 border border-purple-600/20 transform rotate-90">
                <div className="text-xs text-purple-200 text-center mb-1">{opponents[2].name}</div>
                <div className="flex gap-0.5 justify-center">
                  {Array.from({
              length: Math.min(opponents[2].pieces.length, 4)
            }).map((_, i) => <div key={i} className="w-2 h-4 bg-gray-600 rounded border border-gray-700"></div>)}
                </div>
                <div className="text-xs text-purple-300 text-center mt-1">{opponents[2].pieces.length}</div>
              </div>}
          </div>

          {/* Info do prêmio no canto superior direito */}
          <div className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Prêmio R${gameState.prize_amount?.toFixed(2) || '0,00'}
          </div>
        </div> :
    // Layout desktop (layout original)
    <div className="min-h-screen flex flex-col">
          <div className="flex-shrink-0 p-4">
            <OpponentsList opponents={opponents} />
          </div>

          <div className="flex-1 flex items-center justify-center p-4 px-0 py-[56px] my-0">
            <GameBoard placedPieces={placedPieces} onDrop={handleDrop} onDragOver={handleDragOver} className="w-full max-w-4xl" />
          </div>

          <div className="flex-shrink-0 p-4">
            {currentUserPlayer && <PlayerHand playerPieces={currentUserPlayer.pieces} onPieceDrag={handlePieceDrag} onPiecePlay={playPiece} isCurrentPlayer={currentUserPlayer.isCurrentPlayer} playerName={currentUserPlayer.name} timeLeft={timeLeft} onAutoPlay={handleManualAutoPlay} isProcessingMove={isProcessingMove} canPiecePlay={canPiecePlay} />}
          </div>
        </div>}
    </div>;
};
export default Game2Room;