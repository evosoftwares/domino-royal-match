
export interface QueuePlayer {
  id: string;
  displayName: string;
  avatarUrl: string;
  position: number;
}

export interface SimpleMatchmakingState {
  isInQueue: boolean;
  queueCount: number;
  isLoading: boolean;
  queuePlayers: QueuePlayer[];
}
