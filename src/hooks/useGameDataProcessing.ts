
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
      // Validação defensiva da mão do jogador
      let pieces: DominoPieceType[] = [];
      
      if (player.hand && Array.isArray(player.hand)) {
        pieces = player.hand.map((piece: any, index: number): DominoPieceType | null => {
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
        }).filter((p): p is DominoPieceType => p !== null);
      } else {
        console.warn(`Jogador ${player.user_id} tem mão inválida:`, player.hand);
      }

      // Fallback para nome do jogador
      const playerName = player.profiles?.full_name || `Jogador ${player.position || 'Desconhecido'}`;

      return {
        id: player.user_id,
        name: playerName,
        pieces,
        isCurrentPlayer: gameState.current_player_turn === player.user_id,
        position: player.position || 0,
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
    // Validação defensiva do estado do tabuleiro
    if (!gameState?.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      console.warn('Estado do tabuleiro inválido:', gameState?.board_state);
      return [];
    }

    return gameState.board_state.pieces.map((boardPiece: any, index: number): DominoPieceType | null => {
      try {
        let piece;
        if (boardPiece?.piece && Array.isArray(boardPiece.piece)) {
          piece = boardPiece.piece;
        } else if (Array.isArray(boardPiece)) {
          piece = boardPiece;
        } else if (boardPiece && typeof boardPiece === 'object' && typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
          piece = [boardPiece.l, boardPiece.r];
        } else if (boardPiece?.piece && typeof boardPiece.piece === 'object' && typeof boardPiece.piece.l === 'number' && typeof boardPiece.piece.r === 'number') {
          piece = [boardPiece.piece.l, boardPiece.piece.r];
        } else {
          console.warn('Formato de peça do tabuleiro desconhecido:', boardPiece);
          return null;
        }

        return {
          id: `board-piece-${index}`,
          top: piece[0],
          bottom: piece[1]
        };
      } catch (error) {
        console.error('Erro ao processar peça do tabuleiro:', boardPiece, error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);
  }, [gameState.board_state]);

  return {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces
  };
};
