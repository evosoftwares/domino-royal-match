
import { useMemo, useCallback } from 'react';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import { standardizePiece, toDominoPieceType, toBackendFormat } from '@/utils/pieceValidation';

interface UseGameDataProcessingProps {
  gameState: GameData;
  playersState: PlayerData[];
  userId?: string;
}

// Cache global otimizado para processamento de peças por jogador
const playerPiecesCache = new Map<string, { hash: string; pieces: DominoPieceType[]; timestamp: number }>();
const CACHE_EXPIRY_MS = 30000; // 30 segundos

// Função para criar hash otimizado de array de peças
const createPiecesHash = (pieces: any[]): string => {
  if (!Array.isArray(pieces)) return 'invalid';
  return `${pieces.length}-${pieces.map((p, i) => {
    try {
      const std = standardizePiece(p);
      return `${i}:${std.top}${std.bottom}`;
    } catch {
      return `${i}:invalid`;
    }
  }).join('|')}`;
};

// Função para processar peças de um jogador com cache otimizado e padronização
const processPlayerPieces = (player: PlayerData): DominoPieceType[] => {
  const cacheKey = `${player.user_id}-${player.id}`;
  const now = Date.now();
  
  // Verificar cache com expiração
  const cached = playerPiecesCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_EXPIRY_MS) {
    const piecesHash = createPiecesHash(player.hand || []);
    if (cached.hash === piecesHash) {
      return cached.pieces;
    }
  }

  // Processar peças com padronização
  let pieces: DominoPieceType[] = [];
  
  if (player.hand && Array.isArray(player.hand)) {
    pieces = player.hand.map((piece: any, index: number): DominoPieceType | null => {
      try {
        return toDominoPieceType(piece, `${player.user_id}-piece-${index}`);
      } catch (error) {
        console.error(`Falha ao processar peça ${index} para jogador ${player.user_id}:`, piece, error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);
  } else {
    console.warn(`Jogador ${player.user_id} tem mão inválida:`, player.hand);
  }

  // Atualizar cache com timestamp e limite de tamanho
  const piecesHash = createPiecesHash(player.hand || []);
  playerPiecesCache.set(cacheKey, { 
    hash: piecesHash, 
    pieces, 
    timestamp: now 
  });
  
  // Limpar cache antigo (manter apenas últimos 20 jogadores)
  if (playerPiecesCache.size > 20) {
    const oldestKey = Array.from(playerPiecesCache.entries())
      .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0]?.[0];
    if (oldestKey) {
      playerPiecesCache.delete(oldestKey);
    }
  }

  return pieces;
};

export const useGameDataProcessing = ({
  gameState,
  playersState,
  userId
}: UseGameDataProcessingProps) => {
  // Memoização otimizada para cada jogador
  const processedPlayersMap = useMemo(() => {
    const playersMap = new Map<string, ProcessedPlayer>();
    
    playersState.forEach((player) => {
      const pieces = processPlayerPieces(player);
      const playerName = player.profiles?.full_name || `Jogador ${player.position || 'Desconhecido'}`;

      playersMap.set(player.user_id, {
        id: player.user_id,
        name: playerName,
        pieces,
        isCurrentPlayer: gameState.current_player_turn === player.user_id,
        position: player.position || 0,
        originalData: player
      });
    });

    return playersMap;
  }, [playersState, gameState.current_player_turn]);

  // Converter Map para Array apenas quando necessário
  const processedPlayers = useMemo(() => 
    Array.from(processedPlayersMap.values()),
    [processedPlayersMap]
  );

  // Memoização para jogador atual
  const currentUserPlayer = useMemo(() => 
    userId ? processedPlayersMap.get(userId) : undefined,
    [processedPlayersMap, userId]
  );

  // Memoização para oponentes
  const opponents = useMemo(() => 
    processedPlayers.filter(p => p.id !== userId),
    [processedPlayers, userId]
  );

  // Memoização otimizada para peças do tabuleiro com padronização completa
  const placedPieces = useMemo(() => {
    if (!gameState?.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      return [];
    }

    return gameState.board_state.pieces.map((boardPiece: any, index: number): DominoPieceType | null => {
      try {
        let piece;
        
        // Diferentes formatos possíveis - mais robusto com padronização
        if (boardPiece?.piece) {
          piece = boardPiece.piece;
        } else {
          piece = boardPiece;
        }

        return toDominoPieceType(piece, `board-piece-${index}`);
      } catch (error) {
        console.error('Erro ao processar peça do tabuleiro:', boardPiece, error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);
  }, [gameState.board_state]);

  // Função para limpar cache
  const clearCache = useCallback(() => {
    playerPiecesCache.clear();
  }, []);

  // Estatísticas do cache para debugging
  const getCacheStats = useCallback(() => ({
    size: playerPiecesCache.size,
    keys: Array.from(playerPiecesCache.keys()),
    oldestEntry: Math.min(...Array.from(playerPiecesCache.values()).map(v => v.timestamp))
  }), []);

  return {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces,
    clearCache,
    getCacheStats
  };
};
