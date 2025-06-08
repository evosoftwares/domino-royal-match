
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerData } from '@/types/game';
import { cn } from '@/lib/utils';

interface GamePlayersHeaderProps {
  gameId: string;
  currentPlayerId?: string;
}

const GamePlayersHeader: React.FC<GamePlayersHeaderProps> = ({ gameId, currentPlayerId }) => {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const { data, error } = await supabase
          .from('game_players')
          .select(`
            *,
            profiles(full_name, avatar_url)
          `)
          .eq('game_id', gameId)
          .order('position');

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
    const channel = supabase
      .channel(`game_players:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          fetchPlayers(); // Refetch all players when there's a change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-r from-purple-900/50 to-black/50 rounded-lg p-4 mb-4">
        <div className="flex justify-center">
          <div className="text-purple-200">Carregando jogadores...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-purple-900/50 to-black/50 rounded-lg p-4 mb-4 border border-purple-600/30">
      <div className="flex justify-between items-center gap-4 overflow-x-auto">
        {players.map((player, index) => (
          <div
            key={player.id}
            className={cn(
              "flex-shrink-0 flex flex-col items-center p-3 rounded-lg border transition-all duration-300",
              currentPlayerId === player.user_id 
                ? "border-yellow-400 bg-yellow-400/10 shadow-lg shadow-yellow-400/20" 
                : "border-purple-600/30 bg-purple-900/20"
            )}
          >
            <div className={cn(
              "w-3 h-3 rounded-full mb-2",
              currentPlayerId === player.user_id ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
            )} />
            
            <div className="text-center">
              <div className={cn(
                "text-sm font-medium mb-1",
                currentPlayerId === player.user_id ? "text-yellow-400" : "text-purple-200"
              )}>
                {player.profiles?.full_name || `Jogador ${player.position}`}
              </div>
              
              <div className="text-xs text-purple-300">
                Posição {player.position}
              </div>
              
              {player.hand && (
                <div className="text-xs text-purple-300 mt-1">
                  {Array.isArray(player.hand) ? player.hand.length : 0} peças
                </div>
              )}
              
              <div className={cn(
                "text-xs px-2 py-1 rounded-full mt-2",
                player.status === 'active' ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"
              )}>
                {player.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GamePlayersHeader;
