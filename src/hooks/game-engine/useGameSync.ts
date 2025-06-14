
import { useCallback } from 'react';
import { useRealtimeSync } from '../useRealtimeSync';
import { GameData, PlayerData } from '@/types/game';
import { toast } from 'sonner';
import { SyncStatus } from './useGameStatus';
import { useGameMetricsIntegration } from '../useGameMetricsIntegration';

interface UseGameSyncProps {
  gameId: string;
  userId?: string;
  setGameState: React.Dispatch<React.SetStateAction<GameData>>;
  setPlayersState: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
  gameMetrics: ReturnType<typeof useGameMetricsIntegration>;
}

export const useGameSync = ({
  gameId,
  userId,
  setGameState,
  setPlayersState,
  setSyncStatus,
  gameMetrics,
}: UseGameSyncProps) => {
  useRealtimeSync({
    gameId,
    userId,
    onGameUpdate: (updatedGame) => {
      console.log('📥 Atualização do jogo recebida via realtime');
      setGameState(updatedGame);
      setSyncStatus('synced');
      gameMetrics.recordGameSuccess('Realtime Game Update');
    },
    onPlayerUpdate: (updatedPlayer) => {
      console.log('📥 Atualização de jogador recebida via realtime');
      setPlayersState(prev =>
        prev.map(player =>
          player.user_id === updatedPlayer.user_id ? updatedPlayer : player
        )
      );
      gameMetrics.recordGameSuccess('Realtime Player Update');
    },
    onConnectionStatusChange: (status) => {
      const newSyncStatus: SyncStatus = status === 'connected' ? 'synced' : 'failed';
      setSyncStatus(newSyncStatus);

      if (status === 'disconnected') {
        gameMetrics.recordGameError('Connection Lost', new Error('Realtime connection lost'));
      } else if (status === 'connected') {
        gameMetrics.recordGameSuccess('Connection Restored');
      }
    }
  });

  const forceSync = useCallback(async () => {
    console.warn('Force Sync não implementado nesta versão.');
    toast.info('Recurso de Sincronização Forçada em desenvolvimento.');
  }, []);

  return { forceSync };
};
