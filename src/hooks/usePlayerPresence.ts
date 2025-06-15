
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UsePlayerPresenceProps {
  gameId?: string;
  isActive?: boolean;
}

export const usePlayerPresence = ({ gameId, isActive = true }: UsePlayerPresenceProps) => {
  const { user } = useAuth();

  const updatePresence = useCallback(async () => {
    if (!user?.id || !isActive) return;

    try {
      await supabase
        .from('player_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
    } catch (error) {
      console.error('Erro ao atualizar presença:', error);
    }
  }, [user?.id, isActive]);

  const setOffline = useCallback(async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('player_presence')
        .upsert({
          user_id: user.id,
          status: 'offline',
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
    } catch (error) {
      console.error('Erro ao marcar como offline:', error);
    }
  }, [user?.id]);

  // Atualizar presença a cada 15 segundos
  useEffect(() => {
    if (!isActive) return;

    updatePresence(); // Primeira atualização

    const interval = setInterval(updatePresence, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [updatePresence, isActive]);

  // Marcar como offline quando sair da página
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = () => {
      setOffline();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        updatePresence();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setOffline();
    };
  }, [setOffline, updatePresence, isActive]);

  return {
    updatePresence,
    setOffline
  };
};
