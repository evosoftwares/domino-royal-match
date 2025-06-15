
import { useState, useRef } from 'react';
import { SimpleMatchmakingState } from './matchmaking/types';
import { useGameCreation } from './matchmaking/useGameCreation';
import { useQueueManagement } from './matchmaking/useQueueManagement';
import { useRealtimeMatchmaking } from './matchmaking/useRealtimeMatchmaking';

export const useSimpleMatchmaking = () => {
  const [state, setState] = useState<SimpleMatchmakingState>({
    isInQueue: false,
    queueCount: 0,
    isLoading: false,
    queuePlayers: []
  });

  const mountedRef = useRef(true);
  
  const { createGameFromQueue, gameCreationLockRef } = useGameCreation();
  
  const { fetchQueuePlayers, joinQueue, leaveQueue } = useQueueManagement({
    setState,
    mountedRef,
    createGameFromQueue
  });

  useRealtimeMatchmaking({
    fetchQueuePlayers,
    mountedRef,
    gameCreationLockRef
  });

  return {
    ...state,
    joinQueue,
    leaveQueue,
    refreshQueue: fetchQueuePlayers,
  };
};

// Re-export types for backward compatibility
export type { QueuePlayer, SimpleMatchmakingState } from './matchmaking/types';
