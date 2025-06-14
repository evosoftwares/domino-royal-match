
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
      console.log(`💾 Cache hit para jogador ${player.user_id} (${cached.pieces.length} peças)`);
      return cached.pieces;
    }
  }

  console.log(`🔄 Processando peças para jogador ${player.user_id}...`);
  
  // Processar peças com padronização
  let pieces: DominoPieceType[] = [];
  
  if (player.hand && Array.isArray(player.hand)) {
    const startTime = performance.now();
    
    pieces = player.hand.map((piece: any, index: number): DominoPieceType | null => {
      try {
        return toDominoPieceType(piece, `${player.user_id}-piece-${index}`);
      } catch (error) {
        console.error(`❌ Falha ao processar peça ${index} para jogador ${player.user_id}:`, piece, error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Processadas ${pieces.length} peças em ${duration.toFixed(2)}ms para ${player.user_id}`);
    
    if (duration > 10) {
      console.warn(`⚠️ Processamento lento de peças para ${player.user_id}: ${duration.toFixed(2)}ms`);
    }
  } else {
    console.warn(`⚠️ Jogador ${player.user_id} tem mão inválida:`, player.hand);
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
      console.log(`🧹 Removido do cache: ${oldestKey}`);
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
    console.group('👥 Processando dados dos jogadores');
    const startTime = performance.now();
    
    const playersMap = new Map<string, ProcessedPlayer>();
    
    playersState.forEach((player, index) => {
      console.log(`Processando jogador ${index + 1}/${playersState.length}: ${player.user_id}`);
      
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
      
      console.log(`  ✅ ${playerName}: ${pieces.length} peças processadas`);
    });

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`🏁 Processamento completo em ${duration.toFixed(2)}ms`);
    console.groupEnd();

    return playersMap;
  }, [playersState, gameState.current_player_turn]);

  // Converter Map para Array apenas quando necessário
  const processedPlayers = useMemo(() => 
    Array.from(processedPlayersMap.values()),
    [processedPlayersMap]
  );

  // Memoização para jogador atual
  const currentUserPlayer = useMemo(() => {
    const player = userId ? processedPlayersMap.get(userId) : undefined;
    if (player && userId) {
      console.log(`🎯 Jogador atual: ${player.name} (${player.pieces.length} peças)`);
    }
    return player;
  }, [processedPlayersMap, userId]);

  // Memoização para oponentes
  const opponents = useMemo(() => {
    const opponentsList = processedPlayers.filter(p => p.id !== userId);
    console.log(`👤 Oponentes: ${opponentsList.map(o => `${o.name}(${o.pieces.length})`).join(', ')}`);
    return opponentsList;
  }, [processedPlayers, userId]);

  // Memoização otimizada para peças do tabuleiro com padronização completa
  const placedPieces = useMemo(() => {
    if (!gameState?.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      console.log('📋 Tabuleiro vazio');
      return [];
    }

    console.group('📋 Processando peças do tabuleiro');
    const startTime = performance.now();

    const pieces = gameState.board_state.pieces.map((boardPiece: any, index: number): DominoPieceType | null => {
      try {
        let piece;
        
        // Diferentes formatos possíveis - mais robusto com padronização
        if (boardPiece?.piece) {
          piece = boardPiece.piece;
        } else {
          piece = boardPiece;
        }

        const processed = toDominoPieceType(piece, `board-piece-${index}`);
        console.log(`  Peça ${index}: [${processed.top}|${processed.bottom}]`);
        return processed;
      } catch (error) {
        console.error(`❌ Erro ao processar peça ${index} do tabuleiro:`, boardPiece, error);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${pieces.length} peças do tabuleiro processadas em ${duration.toFixed(2)}ms`);
    console.groupEnd();

    return pieces;
  }, [gameState.board_state]);

  // Função para limpar cache
  const clearCache = useCallback(() => {
    const sizeBefore = playerPiecesCache.size;
    playerPiecesCache.clear();
    console.log(`🧹 Cache limpo: ${sizeBefore} entradas removidas`);
  }, []);

  // Estatísticas do cache para debugging
  const getCacheStats = useCallback(() => {
    const stats = {
      size: playerPiecesCache.size,
      keys: Array.from(playerPiecesCache.keys()),
      oldestEntry: playerPiecesCache.size > 0 ? Math.min(...Array.from(playerPiecesCache.values()).map(v => v.timestamp)) : 0,
      totalMemoryUsage: Array.from(playerPiecesCache.values()).reduce((acc, entry) => acc + entry.pieces.length, 0)
    };
    
    console.group('💾 Estatísticas do Cache');
    console.log('Entradas ativas:', stats.size);
    console.log('Peças em cache:', stats.totalMemoryUsage);
    console.log('Idade da entrada mais antiga:', stats.oldestEntry ? `${Date.now() - stats.oldestEntry}ms` : 'N/A');
    console.groupEnd();
    
    return stats;
  }, []);

  // Função para otimizar cache (remover entradas antigas)
  const optimizeCache = useCallback(() => {
    const now = Date.now();
    const entriesBefore = playerPiecesCache.size;
    
    for (const [key, entry] of playerPiecesCache.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRY_MS) {
        playerPiecesCache.delete(key);
      }
    }
    
    const entriesAfter = playerPiecesCache.size;
    const removed = entriesBefore - entriesAfter;
    
    if (removed > 0) {
      console.log(`🔧 Cache otimizado: ${removed} entradas antigas removidas`);
    }
  }, []);

  return {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces,
    clearCache,
    getCacheStats,
    optimizeCache
  };
};
