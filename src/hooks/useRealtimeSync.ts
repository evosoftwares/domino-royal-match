
import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameData, PlayerData } from '@/types/game';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSyncProps {
  gameId: string;
  userId?: string;
  onGameUpdate: (gameData: GameData) => void;
  onPlayerUpdate: (playerData: PlayerData) => void;
  onConnectionStatusChange: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

export const useRealtimeSync = ({
  gameId,
  userId,
  onGameUpdate,
  onPlayerUpdate,
  onConnectionStatusChange
}: UseRealtimeSyncProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const lastHeartbeatRef = useRef<number>(Date.now());

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;
      
      if (timeSinceLastHeartbeat > 15000) {
        onConnectionStatusChange('disconnected');
      } else if (timeSinceLastHeartbeat > 8000) {
        onConnectionStatusChange('reconnecting');
      } else {
        onConnectionStatusChange('connected');
      }
    }, 2000);
  }, [onConnectionStatusChange]);

  useEffect(() => {
    if (!gameId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    try {
      const gameChannel = supabase.channel(`hybrid-game:${gameId}`, {
        config: {
          presence: { key: userId }
        }
      });
      channelRef.current = gameChannel;

      gameChannel.on<GameData>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          lastHeartbeatRef.current = Date.now();
          onGameUpdate(payload.new as GameData);
        }
      );

      gameChannel.on<PlayerData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          lastHeartbeatRef.current = Date.now();
          if (payload.eventType === 'UPDATE') {
            onPlayerUpdate(payload.new as PlayerData);
          }
        }
      );

      gameChannel.subscribe((status) => {
        lastHeartbeatRef.current = Date.now();
        
        if (status === 'SUBSCRIBED') {
          onConnectionStatusChange('connected');
          startHeartbeat();
        } else if (status === 'CHANNEL_ERROR') {
          onConnectionStatusChange('disconnected');
        }
      });

    } catch (error) {
      console.error('Erro ao configurar realtime:', error);
      onConnectionStatusChange('disconnected');
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [gameId, userId, onGameUpdate, onPlayerUpdate, onConnectionStatusChange, startHeartbeat]);

  return {
    isConnected: channelRef.current !== null
  };
};
