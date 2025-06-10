
export interface PlayerProfile {
  full_name: string;
  avatar_url: string;
}

export interface GameData {
  id: string;
  status: string;
  prize_pool: number; // Mudança: era prize_amount, agora prize_pool para corresponder ao banco
  current_player_turn: string | null;
  board_state: any;
  created_at: string;
}

export interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: any;
  // Removendo status pois não existe na tabela game_players
  profiles?: PlayerProfile;
}

export interface DominoPieceType {
  id: string;
  top: number;
  bottom: number;
  orientation?: 'vertical' | 'horizontal';
  originalFormat?: any;
}

export interface ProcessedPlayer {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: PlayerData;
}
