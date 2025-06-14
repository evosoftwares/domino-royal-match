
import { useCallback, useRef } from 'react';
import { DominoPieceType } from '@/types/game';
import { UniversalPieceConverter } from '@/utils/universalPieceConverter';

// Types rigorosamente tipados para validação em tempo de compilação
type StrictPieceFormat = {
  readonly top: number;
  readonly bottom: number;
  readonly isValidated: true;
};

type StrictGameState = {
  readonly id: string;
  readonly status: 'waiting' | 'active' | 'finished';
  readonly board_state: StrictBoardState | null;
  readonly current_player_turn: string | null;
  readonly consecutive_passes: number;
};

type StrictBoardState = {
  readonly pieces: ReadonlyArray<StrictPieceFormat>;
  readonly left_end: number | null;
  readonly right_end: number | null;
};

type StrictPlayerState = {
  readonly user_id: string;
  readonly position: number;
  readonly hand: ReadonlyArray<StrictPieceFormat>;
  readonly isValidated: true;
};

interface ValidationCache {
  [key: string]: boolean;
}

/**
 * Hook para integração TypeScript strict mode com validação em tempo de compilação
 */
export const useTypeScriptStrictMode = () => {
  const validationCache = useRef<ValidationCache>({});

  /**
   * Converte peça para formato strict com validação em tempo de compilação
   */
  const toStrictPiece = useCallback((piece: any): StrictPieceFormat => {
    // Usar o conversor universal para validação
    const universal = UniversalPieceConverter.toUniversal(piece, 'strict-conversion');
    
    if (!universal.isValid) {
      throw new Error(`Invalid piece: [${universal.top}|${universal.bottom}]`);
    }

    // Cache de validação para performance
    const cacheKey = `${universal.top}-${universal.bottom}`;
    if (!validationCache.current[cacheKey]) {
      if (universal.top < 0 || universal.top > 6 || universal.bottom < 0 || universal.bottom > 6) {
        throw new Error(`Piece values out of range: [${universal.top}|${universal.bottom}]`);
      }
      validationCache.current[cacheKey] = true;
    }

    return {
      top: universal.top,
      bottom: universal.bottom,
      isValidated: true as const
    };
  }, []);

  /**
   * Converte array de peças para formato strict
   */
  const toStrictPieces = useCallback((pieces: any[]): ReadonlyArray<StrictPieceFormat> => {
    if (!Array.isArray(pieces)) {
      throw new Error('Expected array of pieces');
    }

    return pieces.map((piece, index) => {
      try {
        return toStrictPiece(piece);
      } catch (error) {
        throw new Error(`Error converting piece at index ${index}: ${error.message}`);
      }
    });
  }, [toStrictPiece]);

  /**
   * Converte estado do tabuleiro para formato strict
   */
  const toStrictBoardState = useCallback((boardState: any): StrictBoardState | null => {
    if (!boardState) {
      return null;
    }

    // Validar estrutura
    if (typeof boardState !== 'object') {
      throw new Error('Board state must be an object');
    }

    const pieces = boardState.pieces ? toStrictPieces(boardState.pieces) : [];
    
    // Validar extremidades
    const left_end = typeof boardState.left_end === 'number' ? boardState.left_end : null;
    const right_end = typeof boardState.right_end === 'number' ? boardState.right_end : null;

    if (left_end !== null && (left_end < 0 || left_end > 6)) {
      throw new Error(`Invalid left_end: ${left_end}`);
    }
    if (right_end !== null && (right_end < 0 || right_end > 6)) {
      throw new Error(`Invalid right_end: ${right_end}`);
    }

    return {
      pieces,
      left_end,
      right_end
    };
  }, [toStrictPieces]);

  /**
   * Converte estado do jogo para formato strict
   */
  const toStrictGameState = useCallback((gameData: any): StrictGameState => {
    if (!gameData || typeof gameData !== 'object') {
      throw new Error('Game data must be an object');
    }

    if (!gameData.id || typeof gameData.id !== 'string') {
      throw new Error('Game must have a valid ID');
    }

    const validStatuses = ['waiting', 'active', 'finished'] as const;
    if (!gameData.status || !validStatuses.includes(gameData.status)) {
      throw new Error(`Invalid game status: ${gameData.status}`);
    }

    const board_state = toStrictBoardState(gameData.board_state);
    
    const current_player_turn = gameData.current_player_turn && typeof gameData.current_player_turn === 'string' 
      ? gameData.current_player_turn 
      : null;

    const consecutive_passes = typeof gameData.consecutive_passes === 'number' 
      ? gameData.consecutive_passes 
      : 0;

    return {
      id: gameData.id,
      status: gameData.status,
      board_state,
      current_player_turn,
      consecutive_passes
    };
  }, [toStrictBoardState]);

  /**
   * Converte estado do jogador para formato strict
   */
  const toStrictPlayerState = useCallback((playerData: any): StrictPlayerState => {
    if (!playerData || typeof playerData !== 'object') {
      throw new Error('Player data must be an object');
    }

    if (!playerData.user_id || typeof playerData.user_id !== 'string') {
      throw new Error('Player must have a valid user_id');
    }

    if (typeof playerData.position !== 'number' || playerData.position < 1) {
      throw new Error(`Invalid player position: ${playerData.position}`);
    }

    const hand = playerData.hand ? toStrictPieces(playerData.hand) : [];

    return {
      user_id: playerData.user_id,
      position: playerData.position,
      hand,
      isValidated: true as const
    };
  }, [toStrictPieces]);

  /**
   * Converte lista de jogadores para formato strict
   */
  const toStrictPlayersState = useCallback((playersData: any[]): ReadonlyArray<StrictPlayerState> => {
    if (!Array.isArray(playersData)) {
      throw new Error('Players data must be an array');
    }

    return playersData.map((player, index) => {
      try {
        return toStrictPlayerState(player);
      } catch (error) {
        throw new Error(`Error converting player at index ${index}: ${error.message}`);
      }
    });
  }, [toStrictPlayerState]);

  /**
   * Valida consistência entre estados
   */
  const validateStateConsistency = useCallback((
    gameState: StrictGameState, 
    playersState: ReadonlyArray<StrictPlayerState>
  ): void => {
    // Verificar se o jogador atual existe
    if (gameState.current_player_turn) {
      const currentPlayerExists = playersState.some(p => p.user_id === gameState.current_player_turn);
      if (!currentPlayerExists) {
        throw new Error(`Current player ${gameState.current_player_turn} not found in players list`);
      }
    }

    // Verificar posições únicas
    const positions = playersState.map(p => p.position);
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      throw new Error('Players have duplicate positions');
    }

    // Verificar sequência de posições
    const sortedPositions = [...positions].sort((a, b) => a - b);
    for (let i = 0; i < sortedPositions.length; i++) {
      if (sortedPositions[i] !== i + 1) {
        throw new Error(`Missing or invalid position sequence. Expected ${i + 1}, got ${sortedPositions[i]}`);
      }
    }
  }, []);

  /**
   * Converte de volta para DominoPieceType
   */
  const fromStrictPiece = useCallback((strictPiece: StrictPieceFormat): DominoPieceType => {
    return {
      id: `piece-${strictPiece.top}-${strictPiece.bottom}-${Date.now()}`,
      top: strictPiece.top,
      bottom: strictPiece.bottom
    };
  }, []);

  /**
   * Limpa cache de validação
   */
  const clearValidationCache = useCallback(() => {
    validationCache.current = {};
  }, []);

  /**
   * Estatísticas do cache
   */
  const getCacheStats = useCallback(() => {
    return {
      size: Object.keys(validationCache.current).length,
      entries: Object.keys(validationCache.current).slice(0, 10)
    };
  }, []);

  return {
    // Conversões para strict mode
    toStrictPiece,
    toStrictPieces,
    toStrictBoardState,
    toStrictGameState,
    toStrictPlayerState,
    toStrictPlayersState,
    
    // Validação
    validateStateConsistency,
    
    // Conversão de volta
    fromStrictPiece,
    
    // Utilitários
    clearValidationCache,
    getCacheStats
  };
};

// Types exportados para uso em outros arquivos
export type {
  StrictPieceFormat,
  StrictGameState,
  StrictBoardState,
  StrictPlayerState
};
