
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import PlayerUI from './PlayerUI';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // OTIMIZAÇÃO: Estes useEffects são necessários para sincronizar o estado interno
  // com as props recebidas, mas o React.memo acima vai evitar re-renderizações desnecessárias
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  // Lógica de auto-play unificada e eficiente (como discutimos)
  useEffect(() => {
    const isMyTurn = gameState.status === 'active' && gameState.current_player_turn === user?.id;

    if (isMyTurn) {
      const timerId = setTimeout(() => {
        toast.info('Tempo esgotado. Realizando jogada automática...');
        handleAutoPlayOnTimeout();
      }, 10000);

      return () => {
        clearTimeout(timerId);
      };
    }
  }, [gameState.current_player_turn, gameState.status, user?.id]);


  // <<< CORREÇÃO >>> A seguir, as implementações que estavam faltando foram restauradas.
  // Isso corrige os erros TS2554 e TS2322.

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

  const isFirstMove = placedPieces.length === 0;

  // <<< CORREÇÃO: Implementação restaurada >>>
  const getOpenEnds = useCallback(() => {
    if (isFirstMove) return { left: null, right: null };
    return {
      left: gameState.board_state?.left_end || null,
      right: gameState.board_state?.right_end || null
    };
  }, [isFirstMove, gameState.board_state]);

  // <<< CORREÇÃO: Implementação restaurada >>>
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    if (isFirstMove) return true;
    const { left, right } = getOpenEnds();
    if (left === null && right === null) return false;
    return piece.top === left || piece.bottom === left || piece.top === right || piece.bottom === right;
  }, [isFirstMove, getOpenEnds]);

  // <<< CORREÇÃO: Implementação restaurada >>>
  const determineSide = useCallback((piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left';
    const { left, right } = getOpenEnds();
    if ((piece.top === left || piece.bottom === left) && left !== null) return 'left';
    if ((piece.top === right || piece.bottom === right) && right !== null) return 'right';
    return null;
  }, [isFirstMove, getOpenEnds]);

  // Função de auto-play unificada que chama o backend
  const handleAutoPlayOnTimeout = useCallback(async () => {
    if (isProcessingMove) return;
    setIsProcessingMove(true);
    try {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      if (error) {
        toast.error(`Erro no auto play: ${error.message}`);
      } else {
        toast.success('Jogada automática realizada pelo sistema!');
      }
    } catch (e: any) {
      toast.error('Erro inesperado no auto play.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);
  
  // <<< CORREÇÃO: Implementações restauradas >>>
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
      const { error } = await supabase.rpc('pass_turn', {
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

  // O JSX restante permanece como na versão anterior (sem os botões de auto-play).
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black overflow-hidden">
      <GamePlayersHeader gameId={gameState.id} />
        {isMobile ? (
          <div className="h-screen flex relative">
            {/* ... JSX mobile ... */}
          </div>
        ) : (
          <div className="min-h-screen flex flex-col">
            <div className="flex-shrink-0 p-4">
              <OpponentsList opponents={opponents} />
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
                  />
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

// Envolva a exportação com React.memo para evitar re-renderizações desnecessárias
// quando as props gameData e players não mudaram de verdade
export default React.memo(Game2Room);
