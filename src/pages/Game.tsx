import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import GameRoom from '@/components/GameRoom';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GameData {
  id: string;
  status: string;
  prize_amount: number;
  current_player_turn: string | null;
  board_state: any;
  created_at: string;
}

interface PlayerProfile {
  full_name: string;
  avatar_url: string;
}

interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: any;
  status: string;
  profiles: PlayerProfile;
}

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string; }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar dados do jogo e jogadores
  const fetchGameData = async () => {
    if (!gameId || !user) {
      setError('ID do jogo ou usuário não encontrado');
      setIsLoading(false);
      return;
    }

    try {
      console.log('=== FETCHING GAME DATA ===');
      console.log('Game ID:', gameId);
      console.log('User ID:', user.id);

      // Primeiro, verificar se o usuário está no jogo
      const { data: userPlayerCheck, error: userCheckError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .single();

      if (userCheckError || !userPlayerCheck) {
        console.error('Usuário não está no jogo:', userCheckError);
        setError('Você não tem acesso a este jogo');
        setIsLoading(false);
        return;
      }

      console.log('User player check passed:', userPlayerCheck);

      // Buscar dados do jogo
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('Erro ao buscar jogo:', gameError);
        setError('Jogo não encontrado');
        setIsLoading(false);
        return;
      }

      console.log('Game data fetched:', game);

      // Buscar todos os jogadores com profiles
      const { data: gamePlayers, error: playersError } = await supabase
        .from('game_players')
        .select(`
          id,
          user_id,
          position,
          hand,
          status,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('game_id', gameId)
        .order('position');

      if (playersError) {
        console.error('Erro ao buscar jogadores:', playersError);
        setError('Erro ao carregar jogadores');
        setIsLoading(false);
        return;
      }

      console.log('=== PLAYERS DATA FETCHED ===');
      console.log('Raw players data:', gamePlayers);
      
      // Log detalhado de cada jogador
      gamePlayers?.forEach((player, index) => {
        console.log(`Player ${index + 1}:`, {
          id: player.id,
          user_id: player.user_id,
          position: player.position,
          hand: player.hand,
          hand_type: typeof player.hand,
          hand_length: Array.isArray(player.hand) ? player.hand.length : 'Not array',
          status: player.status,
          profile: player.profiles
        });
      });

      setGameData(game);
      setPlayers(gamePlayers || []);
      setIsLoading(false);
      
      if (gamePlayers && gamePlayers.length > 0) {
        toast.success(`Jogo carregado! ${gamePlayers.length} jogadores encontrados`);
      }
    } catch (error: any) {
      console.error('Erro inesperado ao carregar jogo:', error);
      setError('Erro ao carregar o jogo: ' + error.message);
      setIsLoading(false);
    }
  };

  // Subscrição em tempo real
  useEffect(() => {
    fetchGameData();

    if (!gameId) return;

    console.log('Setting up realtime subscriptions for game:', gameId);

    const gameChannel = supabase.channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, payload => {
        console.log('Game updated via realtime:', payload);
        if (payload.new) {
          setGameData(payload.new as GameData);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameId}`
      }, payload => {
        console.log('Game players updated via realtime:', payload);
        fetchGameData(); // Re-fetch para garantir dados atualizados
      })
      .subscribe();

    return () => {
      console.log('Cleaning up realtime subscription for game:', gameId);
      supabase.removeChannel(gameChannel);
    };
  }, [gameId, user]);

  const handleBackToLobby = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Carregando Jogo</h3>
            <p className="text-purple-200">Preparando o tabuleiro...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-red-500/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Erro no Jogo</h3>
            <p className="text-red-300 mb-6">{error}</p>
            <Button onClick={handleBackToLobby} variant="destructive" className="bg-red-600 hover:bg-red-700">
              Voltar ao Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Jogo não encontrado</h3>
            <p className="text-purple-200 mb-6">Os dados do jogo não puderam ser carregados</p>
            <Button onClick={handleBackToLobby} className="bg-purple-600 hover:bg-purple-700">
              Voltar ao Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <GameRoom gameData={gameData} players={players} />
      </div>
    </div>
  );
};

export default Game;
