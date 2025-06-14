import { useMemo } from 'react';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import { standardizePiece, toBackendFormat } from '@/utils/pieceValidation';

interface UseGameDataProcessingProps {
  gameState: GameData;
  playersState: PlayerData[];
  userId?: string;
}

export const useGameDataProcessing = ({
  gameState,
  playersState,
  userId
}: UseGameDataProcessingProps) => {
  const processedPlayers: ProcessedPlayer[] = useMemo(() => {
    return playersState.map((player): ProcessedPlayer => {
      const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) 
        ? player.hand.map((piece: any, index: number): DominoPieceType | null => {
            try {
              const standard = standardizePiece(piece);
              return {
                id: `${player.user_id}-piece-${index}`,
                top: standard.left,
                bottom: standard.right,
                originalFormat: toBackendFormat(standard)
              };
            } catch (e) {
              console.error(`Falha ao processar peça para o jogador ${player.user_id}:`, piece, e);
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
    });
  }, [playersState, gameState.current_player_turn]);

  const currentUserPlayer = useMemo(() => 
    processedPlayers.find(p => p.id === userId), 
    [processedPlayers, userId]
  );

  const opponents = useMemo(() => 
    processedPlayers.filter(p => p.id !== userId), 
    [processedPlayers, userId]
  );

  const placedPieces: DominoPieceType[] = useMemo(() => {
    if (!gameState.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      return [];
    }

    return gameState.board_state.pieces.map((boardPiece: any, index: number) => {
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
  }, [gameState.board_state]);

  return {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces
  };
};
