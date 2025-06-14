
import { useMemo, useCallback } from 'react';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import { gameCache, createPlayerPiecesKey, createHandHash } from '@/utils/gameCache';
import { createStandardDominoPiece } from '@/utils/standardPieceValidation';
import { useErrorHandler } from '@/utils/errorHandler';

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
  const { handlePieceFormatError } = useErrorHandler();

  // Processamento otimizado de peças por jogador com cache centralizado
  const processPlayerPieces = useCallback((player: PlayerData): DominoPieceType[] => {
    const handHash = createHandHash(player.hand || []);
    const cacheKey = createPlayerPiecesKey(player.user_id, handHash);
    
    // Verificar cache primeiro
    const cached = gameCache.getPlayerPieces(cacheKey);
    if (cached !== null) {
      console.log(`💾 Cache hit para jogador ${player.user_id} (${cached.length} peças)`);
      return cached;
    }

    console.log(`🔄 Processando peças para jogador ${player.user_id}...`);
    
    let pieces: DominoPieceType[] = [];
    
    if (player.hand && Array.isArray(player.hand)) {
      const startTime = performance.now();
      
      pieces = player.hand.map((piece: any, index: number): DominoPieceType | null => {
        try {
          return createStandardDominoPiece(piece, `${player.user_id}-piece-${index}`);
        } catch (error: any) {
          const gameError = handlePieceFormatError(piece, 'DominoPieceType');
          console.error(`❌ Falha ao processar peça ${index} para jogador ${player.user_id}:`, gameError.message);
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

    // Armazenar no cache centralizado
    gameCache.setPlayerPieces(cacheKey, pieces);
    
    return pieces;
  }, [handlePieceFormatError]);

  // Memoização otimizada para processamento de jogadores
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
  }, [playersState, gameState.current_player_turn, processPlayerPieces]);

  // Conversão otimizada Map -> Array
  const processedPlayers = useMemo(() => 
    Array.from(processedPlayersMap.values()),
    [processedPlayersMap]
  );

  // Jogador atual otimizado
  const currentUserPlayer = useMemo(() => {
    const player = userId ? processedPlayersMap.get(userId) : undefined;
    if (player && userId) {
      console.log(`🎯 Jogador atual: ${player.name} (${player.pieces.length} peças)`);
    }
    return player;
  }, [processedPlayersMap, userId]);

  // Oponentes otimizados
  const opponents = useMemo(() => {
    const opponentsList = processedPlayers.filter(p => p.id !== userId);
    console.log(`👤 Oponentes: ${opponentsList.map(o => `${o.name}(${o.pieces.length})`).join(', ')}`);
    return opponentsList;
  }, [processedPlayers, userId]);

  // Peças do tabuleiro otimizadas com padronização
  const placedPieces = useMemo(() => {
    if (!gameState?.board_state?.pieces || !Array.isArray(gameState.board_state.pieces)) {
      console.log('📋 Tabuleiro vazio');
      return [];
    }

    console.group('📋 Processando peças do tabuleiro');
    const startTime = performance.now();

    const pieces = gameState.board_state.pieces.map((boardPiece: any, index: number): DominoPieceType | null => {
      try {
        const piece = boardPiece?.piece || boardPiece;
        const processed = createStandardDominoPiece(piece, `board-piece-${index}`);
        console.log(`  Peça ${index}: [${processed.top}|${processed.bottom}]`);
        return processed;
      } catch (error: any) {
        const gameError = handlePieceFormatError(boardPiece, 'DominoPieceType');
        console.error(`❌ Erro ao processar peça ${index} do tabuleiro:`, gameError.message);
        return null;
      }
    }).filter((p): p is DominoPieceType => p !== null);

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${pieces.length} peças do tabuleiro processadas em ${duration.toFixed(2)}ms`);
    console.groupEnd();

    return pieces;
  }, [gameState.board_state, handlePieceFormatError]);

  // Utilitários de gerenciamento de cache
  const clearCache = useCallback(() => {
    gameCache.clearAll();
  }, []);

  const getCacheStats = useCallback(() => {
    return gameCache.getStats();
  }, []);

  const optimizeCache = useCallback(() => {
    gameCache.optimize();
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
