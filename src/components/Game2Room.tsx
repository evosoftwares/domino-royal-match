import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType, DragEndEvent } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import PlayerUI from './PlayerUI';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  DndContext, 
  DragEndEvent as DndDragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import DominoPiece from './DominoPiece';

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
  const [activeDragItem, setActiveDragItem] = useState<DominoPieceType | null>(null);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // Configuração dos sensores para @dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requer movimento de 8px para ativar o drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // OTIMIZAÇÃO: Estes useEffects são necessários para sincronizar o estado interno
  // com as props recebidas, mas o React.memo acima vai evitar re-renderizações desnecessárias
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

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
    } catch (e: unknown) {
      toast.error('Erro inesperado no auto play.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);

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
  }, [gameState.current_player_turn, gameState.status, user?.id, handleAutoPlayOnTimeout]);

  const processedPlayers: ProcessedPlayer[] = playersState.map((player): ProcessedPlayer => {
    const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) 
      ? player.hand.map((piece: unknown, index: number): DominoPieceType | null => {
          if (piece && typeof piece === 'object' && piece !== null && 'l' in piece && 'r' in piece) {
            const typedPiece = piece as { l: number; r: number };
            return {
              id: `${player.user_id}-piece-${index}`,
              top: typedPiece.l,
              bottom: typedPiece.r,
              originalFormat: {
                id: `${player.user_id}-piece-${index}`,
                values: [typedPiece.l, typedPiece.r] as [number, number]
              }
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
    placedPieces = gameState.board_state.pieces.map((boardPiece: unknown, index: number) => {
      let piece;
      if (boardPiece && typeof boardPiece === 'object' && boardPiece !== null) {
        const typedBoardPiece = boardPiece as { piece?: number[]; l?: number; r?: number };
        if (typedBoardPiece.piece && Array.isArray(typedBoardPiece.piece)) {
          piece = typedBoardPiece.piece;
        } else if (Array.isArray(boardPiece)) {
          piece = boardPiece as number[];
        } else if (typeof typedBoardPiece.l === 'number' && typeof typedBoardPiece.r === 'number') {
          piece = [typedBoardPiece.l, typedBoardPiece.r];
        } else {
          return null;
        }
      } else if (Array.isArray(boardPiece)) {
        piece = boardPiece as number[];
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

  // Handlers para @dnd-kit
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedPiece = currentUserPlayer?.pieces.find(piece => piece.id === active.id);
    if (draggedPiece) {
      setActiveDragItem(draggedPiece);
    }
  };

  const handleDragEnd = (event: DndDragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) {
      // Peça foi solta fora de uma área válida
      toast.info('Solte a peça no tabuleiro para jogar');
      return;
    }

    // Verifica se foi solta no tabuleiro
    if (over.id === 'game-board') {
      const draggedPiece = currentUserPlayer?.pieces.find(piece => piece.id === active.id);
      if (draggedPiece && currentUserPlayer?.isCurrentPlayer && !isProcessingMove) {
        playPiece(draggedPiece);
      }
    }
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
      const pieceForRPC = piece.originalFormat ? 
        { l: piece.originalFormat.values[0], r: piece.originalFormat.values[1] } : 
        { l: piece.top, r: piece.bottom };
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
    } catch (e: unknown) {
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
    } catch (e: unknown) {
      toast.error('Erro inesperado ao passar a vez.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);

  if (gameState.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        {/* ... JSX ... */}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
                isDropAllowed={currentUserPlayer?.isCurrentPlayer && !isProcessingMove}
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
                    canPiecePlay={canPiecePlay}
                  />
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Overlay que mostra a peça sendo arrastada */}
        <DragOverlay>
          {activeDragItem ? (
            <DominoPiece
              topValue={activeDragItem.top}
              bottomValue={activeDragItem.bottom}
              isDragging={true}
              className="rotate-6 shadow-2xl"
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

// Envolva a exportação com React.memo para evitar re-renderizações desnecessárias
// quando as props gameData e players não mudaram de verdade
export default React.memo(Game2Room);