
import { useMemo } from 'react';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import { standardizePiece, toBackendFormat } from '@/utils/pieceValidation';

interface UseGameDataProcessingProps {
  gameState: GameData;
  playersState: PlayerData[];
  userId?: string;
}

// Cache para processamento de peças por jogador
const playerPiecesCache = new Map<string, { hash: string; pieces: DominoPieceType[] }>();

// Função para criar hash de array de peças
const createPiecesHash = (pieces: any[]): string => {
  if (!Array.isArray(pieces)) return 'invalid';
  return pieces.length + '-' + pieces.map(p => 
    typeof p === 'object' ? `${p.l || p.left || p.top || 0}${p.r || p.right || p.bottom || 0}` : '00'
  ).join('');
};

// Função para processar peças de um jogador com cache
const processPlayerPieces = (player: PlayerData): DominoPieceType[] => {
  const cacheKey = `${player.user_id}-${player.id}`;
  const piecesHash = createPiecesHash(player.hand || []);
  
  // Verificar cache
  const cached = playerPiecesCache.get(cacheKey);
  if (cached && cached.hash === piecesHash) {
    return cached.pieces;
  }

  // Processar peças
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

  // Atualizar cache
  playerPiecesCache.set(cacheKey, { hash: piecesHash, pieces });
  
  // Limpar cache antigo (manter apenas últimos 10 jogadores)
  if (playerPiecesCache.size > 10) {
    const firstKey = playerPiecesCache.keys().next().value;
    if (firstKey) playerPiecesCache.delete(firstKey);
  }

  return pieces;
};

export const useGameDataProcessing = ({
  gameState,
  playersState,
  userId
}: UseGameDataProcessingProps) => {
  // Memoização granular para jogadores processados
  const processedPlayers: ProcessedPlayer[] = useMemo(() => {
    return playersState.map((player): ProcessedPlayer => {
      const pieces = processPlayerPieces(player);
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

  // Memoização separada para jogador atual
  const currentUserPlayer = useMemo(() => 
    processedPlayers.find(p => p.id === userId), 
    [processedPlayers, userId]
  );

  // Memoização separada para oponentes
  const opponents = useMemo(() => 
    processedPlayers.filter(p => p.id !== userId), 
    [processedPlayers, userId]
  );

  // Memoização otimizada para peças do tabuleiro
  const placedPieces: DominoPieceType[] = useMemo(() => {
    if (!gameState?.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      return [];
    }

    return gameState.board_state.pieces.map((boardPiece: any, index: number): DominoPieceType | null => {
      try {
        let piece;
        
        // Diferentes formatos possíveis
        if (boardPiece?.piece && Array.isArray(boardPiece.piece)) {
          piece = boardPiece.piece;
        } else if (Array.isArray(boardPiece)) {
          piece = boardPiece;
        } else if (boardPiece && typeof boardPiece === 'object') {
          if (typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
            piece = [boardPiece.l, boardPiece.r];
          } else if (boardPiece.piece && typeof boardPiece.piece.l === 'number' && typeof boardPiece.piece.r === 'number') {
            piece = [boardPiece.piece.l, boardPiece.piece.r];
          } else {
            console.warn('Formato de peça do tabuleiro desconhecido:', boardPiece);
            return null;
          }
        } else {
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

  // Limpar cache quando necessário
  const clearCache = useMemo(() => () => {
    playerPiecesCache.clear();
  }, []);

  return {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces,
    clearCache
  };
};
