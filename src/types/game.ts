export interface PlayerProfile {
  full_name: string;
  avatar_url: string;
}

export interface BoardState {
  pieces: DominoPieceType[];
  leftEnd: number;
  rightEnd: number;
}

export interface GameData {
  id: string;
  status: string;
  prize_amount: number;
  current_player_turn: string | null;
  board_state: BoardState | null;
  created_at: string;
}

export interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: DominoPieceType[];
  status: string;
  profiles?: PlayerProfile;
}

export interface DominoPieceType {
  id: string;
  top: number;
  bottom: number;
  orientation?: 'vertical' | 'horizontal';
  originalFormat?: {
    id: string;
    values: [number, number];
  };
}

export interface ProcessedPlayer {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: PlayerData;
}
