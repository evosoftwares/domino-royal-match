
/**
 * Tipos de dados rigorosamente tipados para o modo estrito.
 */

// Formato de peça estritamente tipado
export type StrictPieceFormat = {
  readonly top: number;
  readonly bottom: number;
  readonly isValidated: true;
};

// Estado do jogo estritamente tipado
export type StrictGameState = {
  readonly id: string;
  readonly status: 'waiting' | 'active' | 'finished';
  readonly board_state: StrictBoardState | null;
  readonly current_player_turn: string | null;
  readonly consecutive_passes: number;
};

// Estado do tabuleiro estritamente tipado
export type StrictBoardState = {
  readonly pieces: ReadonlyArray<StrictPieceFormat>;
  readonly left_end: number | null;
  readonly right_end: number | null;
};

// Estado do jogador estritamente tipado
export type StrictPlayerState = {
  readonly user_id: string;
  readonly position: number;
  readonly hand: ReadonlyArray<StrictPieceFormat>;
  readonly isValidated: true;
};

// Interface para o cache de validação
export interface ValidationCache {
  [key: string]: boolean;
}
