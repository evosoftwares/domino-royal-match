
import { useState, useMemo } from 'react';

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'failed';
export type ActionType = 'playing' | 'passing' | 'auto_playing' | 'syncing' | null;

export const useGameStatus = () => {
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  const isProcessingMove = useMemo(() => currentAction !== null, [currentAction]);

  return {
    currentAction,
    setCurrentAction,
    syncStatus,
    setSyncStatus,
    isProcessingMove,
  };
};
