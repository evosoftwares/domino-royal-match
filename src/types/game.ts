export interface PlayerProfile {
  full_name: string;
  avatar_url: string;
}

export interface GameData {
  id: string;
  status: string;
  prize_pool: number;
  current_player_turn: string | null;
  board_state: any;
  created_at: string;
  consecutive_passes: number;
  turn_start_time?: string | null;
}

export interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: any;
  profiles?: PlayerProfile;
}

// Interface padronizada para peças de dominó - usando top/bottom consistentemente
export interface DominoPieceType {
  id: string;
  top: number;
  bottom: number;
  orientation?: 'vertical' | 'horizontal';
  originalFormat?: any; // Mantém referência ao formato original para compatibilidade
}

// Interface para formato interno padronizado
export interface StandardPieceFormat {
  top: number;
  bottom: number;
}

// Interface para formato do backend
export interface BackendPieceFormat {
  l: number;
  r: number;
}

export interface ProcessedPlayer {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: PlayerData;
}

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  side?: 'left' | 'right';
}
