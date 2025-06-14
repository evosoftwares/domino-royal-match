
import { useCallback, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { standardizePiece, extractBoardEnds, getCacheStats, clearValidationCache } from '@/utils/pieceValidation';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalPieces: number;
    boardPieces: number;
    playerPieces: number;
    cacheHitRate: number;
  };
}

export const useGameDataValidator = () => {
  const validateGameData = useCallback((gameState: GameData, playersState: PlayerData[]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalPieces = 0;
    let boardPieces = 0;
    let playerPieces = 0;

    console.group('🔍 Game Data Validation');
    
    try {
      // Validar estado do tabuleiro
      if (gameState.board_state?.pieces) {
        boardPieces = gameState.board_state.pieces.length;
        console.log(`📋 Tabuleiro: ${boardPieces} peças`);
        
        // Validar cada peça do tabuleiro
        gameState.board_state.pieces.forEach((boardPiece: any, index: number) => {
          try {
            const piece = boardPiece?.piece || boardPiece;
            const standardized = standardizePiece(piece);
            console.log(`  Peça ${index}: [${standardized.top}|${standardized.bottom}]`);
          } catch (error) {
            errors.push(`Peça inválida no tabuleiro (posição ${index}): ${error.message}`);
          }
        });

        // Validar extremidades do tabuleiro
        const boardEnds = extractBoardEnds(gameState.board_state);
        console.log(`🎯 Extremidades: esquerda=${boardEnds.left}, direita=${boardEnds.right}`);
        
        if (boardPieces > 0 && (boardEnds.left === null || boardEnds.right === null)) {
          warnings.push('Extremidades do tabuleiro não foram calculadas corretamente');
        }
      }

      // Validar jogadores
      console.log(`👥 Validando ${playersState.length} jogadores:`);
      playersState.forEach((player, playerIndex) => {
        console.log(`  Jogador ${playerIndex + 1} (${player.user_id}):`);
        
        if (player.hand && Array.isArray(player.hand)) {
          const handSize = player.hand.length;
          playerPieces += handSize;
          console.log(`    📝 Mão: ${handSize} peças`);
          
          // Validar cada peça na mão do jogador
          player.hand.forEach((piece: any, pieceIndex: number) => {
            try {
              const standardized = standardizePiece(piece);
              console.log(`      [${standardized.top}|${standardized.bottom}]`);
            } catch (error) {
              errors.push(`Peça inválida na mão do jogador ${player.user_id} (posição ${pieceIndex}): ${error.message}`);
            }
          });
        } else {
          warnings.push(`Jogador ${player.user_id} tem mão inválida ou vazia`);
        }
      });

      totalPieces = boardPieces + playerPieces;
      console.log(`🔢 Total de peças: ${totalPieces} (tabuleiro: ${boardPieces}, jogadores: ${playerPieces})`);

      // Validar total de peças (jogo de dominó tem 28 peças)
      if (totalPieces > 28) {
        errors.push(`Número excessivo de peças: ${totalPieces} (máximo: 28)`);
      } else if (totalPieces < 20 && playersState.length > 1) {
        warnings.push(`Número baixo de peças: ${totalPieces} (pode indicar problema nos dados)`);
      }

      // Verificar turno atual
      const currentPlayer = playersState.find(p => p.user_id === gameState.current_player_turn);
      if (!currentPlayer && playersState.length > 0) {
        warnings.push('Turno atual não corresponde a nenhum jogador válido');
      } else if (currentPlayer) {
        console.log(`🎲 Turno atual: ${currentPlayer.profiles?.full_name || currentPlayer.user_id}`);
      }

    } catch (error) {
      errors.push(`Erro durante validação: ${error.message}`);
    }

    // Estatísticas do cache
    const cacheStats = getCacheStats();
    const cacheHitRate = cacheStats.size > 0 ? (cacheStats.size / (cacheStats.size + 1)) * 100 : 0;
    console.log(`💾 Cache de validação: ${cacheStats.size} entradas, taxa de acerto: ${cacheHitRate.toFixed(1)}%`);

    console.groupEnd();

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalPieces,
        boardPieces,
        playerPieces,
        cacheHitRate
      }
    };
  }, []);

  const clearCache = useCallback(() => {
    clearValidationCache();
    console.log('🧹 Cache de validação limpo');
  }, []);

  return {
    validateGameData,
    clearCache
  };
};
