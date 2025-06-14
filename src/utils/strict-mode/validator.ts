
import { StrictGameState, StrictPlayerState } from './types';

/**
 * Valida consistência entre estados do jogo e dos jogadores.
 */
export const validateStateConsistency = (
  gameState: StrictGameState,
  playersState: ReadonlyArray<StrictPlayerState>
): void => {
  if (gameState.current_player_turn) {
    const currentPlayerExists = playersState.some(p => p.user_id === gameState.current_player_turn);
    if (!currentPlayerExists) {
      throw new Error(`Current player ${gameState.current_player_turn} not found in players list`);
    }
  }

  const positions = playersState.map(p => p.position);
  const uniquePositions = new Set(positions);
  if (positions.length !== uniquePositions.size) {
    throw new Error('Players have duplicate positions');
  }

  const sortedPositions = [...positions].sort((a, b) => a - b);
  for (let i = 0; i < sortedPositions.length; i++) {
    if (sortedPositions[i] !== i + 1) {
      throw new Error(`Missing or invalid position sequence. Expected ${i + 1}, got ${sortedPositions[i]}`);
    }
  }
};
