import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerData } from '@/types/game';
import { cn } from '@/lib/utils';
interface GamePlayersHeaderProps {
  gameId: string;
  currentPlayerId?: string;
}
const GamePlayersHeader: React.FC<GamePlayersHeaderProps> = ({
  gameId,
  currentPlayerId
}) => {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('game_players').select(`
            *,
            profiles(full_name, avatar_url)
          `).eq('game_id', gameId).order('position');
        if (error) {
          console.error('Erro ao buscar jogadores:', error);
          return;
        }
        setPlayers(data || []);
      } catch (e) {
        console.error('Erro inesperado:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();

    // Subscribe to real-time updates
    const channel = supabase.channel(`game_players:${gameId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_players',
      filter: `game_id=eq.${gameId}`
    }, payload => {
      fetchPlayers(); // Refetch all players when there's a change
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);
  if (loading) {
    return <div className="w-full bg-gradient-to-r from-purple-900/50 to-black/50 rounded-lg p-4 mb-4">
        <div className="flex justify-center">
          <div className="text-purple-200">Carregando jogadores...</div>
        </div>
      </div>;
  }
  return;
};
export default GamePlayersHeader;