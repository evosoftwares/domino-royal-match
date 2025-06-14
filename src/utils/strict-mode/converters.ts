
import { DominoPieceType } from '@/types/game';
import { UniversalPieceConverter } from '@/utils/universalPieceConverter';
import { StrictPieceFormat, StrictBoardState, StrictGameState, StrictPlayerState, ValidationCache } from './types';

export const convertToStrictPiece = (piece: any, cache: ValidationCache): StrictPieceFormat => {
  const universal = UniversalPieceConverter.toUniversal(piece, 'strict-conversion');
  if (!universal.isValid) {
    throw new Error(`Invalid piece: [${universal.top}|${universal.bottom}]`);
  }

  const cacheKey = `${universal.top}-${universal.bottom}`;
  if (!cache[cacheKey]) {
    if (universal.top < 0 || universal.top > 6 || universal.bottom < 0 || universal.bottom > 6) {
      throw new Error(`Piece values out of range: [${universal.top}|${universal.bottom}]`);
    }
    cache[cacheKey] = true;
  }

  return {
    top: universal.top,
    bottom: universal.bottom,
    isValidated: true as const
  };
};

export const convertToStrictPieces = (pieces: any[], cache: ValidationCache): ReadonlyArray<StrictPieceFormat> => {
  if (!Array.isArray(pieces)) {
    throw new Error('Expected array of pieces');
  }
  return pieces.map((piece, index) => {
    try {
      return convertToStrictPiece(piece, cache);
    } catch (error: any) {
      throw new Error(`Error converting piece at index ${index}: ${error.message}`);
    }
  });
};

export const convertToStrictBoardState = (boardState: any, cache: ValidationCache): StrictBoardState | null => {
  if (!boardState) return null;
  if (typeof boardState !== 'object') throw new Error('Board state must be an object');

  const pieces = boardState.pieces ? convertToStrictPieces(boardState.pieces, cache) : [];
  const left_end = typeof boardState.left_end === 'number' ? boardState.left_end : null;
  const right_end = typeof boardState.right_end === 'number' ? boardState.right_end : null;

  if (left_end !== null && (left_end < 0 || left_end > 6)) throw new Error(`Invalid left_end: ${left_end}`);
  if (right_end !== null && (right_end < 0 || right_end > 6)) throw new Error(`Invalid right_end: ${right_end}`);

  return { pieces, left_end, right_end };
};

export const convertToStrictGameState = (gameData: any, cache: ValidationCache): StrictGameState => {
  if (!gameData || typeof gameData !== 'object') throw new Error('Game data must be an object');
  if (!gameData.id || typeof gameData.id !== 'string') throw new Error('Game must have a valid ID');

  const validStatuses = ['waiting', 'active', 'finished'] as const;
  if (!gameData.status || !validStatuses.includes(gameData.status)) {
    throw new Error(`Invalid game status: ${gameData.status}`);
  }

  const board_state = convertToStrictBoardState(gameData.board_state, cache);
  const current_player_turn = gameData.current_player_turn && typeof gameData.current_player_turn === 'string' ? gameData.current_player_turn : null;
  const consecutive_passes = typeof gameData.consecutive_passes === 'number' ? gameData.consecutive_passes : 0;

  return {
    id: gameData.id,
    status: gameData.status,
    board_state,
    current_player_turn,
    consecutive_passes
  };
};

export const convertToStrictPlayerState = (playerData: any, cache: ValidationCache): StrictPlayerState => {
  if (!playerData || typeof playerData !== 'object') throw new Error('Player data must be an object');
  if (!playerData.user_id || typeof playerData.user_id !== 'string') throw new Error('Player must have a valid user_id');
  if (typeof playerData.position !== 'number' || playerData.position < 1) throw new Error(`Invalid player position: ${playerData.position}`);

  const hand = playerData.hand ? convertToStrictPieces(playerData.hand, cache) : [];

  return {
    user_id: playerData.user_id,
    position: playerData.position,
    hand,
    isValidated: true as const
  };
};

export const convertToStrictPlayersState = (playersData: any[], cache: ValidationCache): ReadonlyArray<StrictPlayerState> => {
  if (!Array.isArray(playersData)) {
    throw new Error('Players data must be an array');
  }
  return playersData.map((player, index) => {
    try {
      return convertToStrictPlayerState(player, cache);
    } catch (error: any) {
      throw new Error(`Error converting player at index ${index}: ${error.message}`);
    }
  });
};

export const convertFromStrictPiece = (strictPiece: StrictPieceFormat): DominoPieceType => {
  return {
    id: `piece-${strictPiece.top}-${strictPiece.bottom}-${Date.now()}`,
    top: strictPiece.top,
    bottom: strictPiece.bottom
  };
};
