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
interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: any;
  status: string;
}
const Game: React.FC = () => {
  const {
    gameId
  } = useParams<{
    gameId: string;
  }>();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar se o usuário pode acessar este jogo
  const verifyGameAccess = async () => {
    if (!gameId || !user) {
      setError('ID do jogo ou usuário não encontrado');
      setIsLoading(false);
      return;
    }
    try {
      // Verificar se o usuário está no jogo
      const {
        data: playerData,
        error: playerError
      } = await supabase.from('game_players').select('*').eq('game_id', gameId).eq('user_id', user.id).single();
      if (playerError || !playerData) {
        setError('Você não tem acesso a este jogo');
        setIsLoading(false);
        return;
      }

      // Buscar dados do jogo
      const {
        data: game,
        error: gameError
      } = await supabase.from('games').select('*').eq('id', gameId).single();
      if (gameError || !game) {
        setError('Jogo não encontrado');
        setIsLoading(false);
        return;
      }

      // Buscar todos os jogadores
      const {
        data: allPlayers,
        error: playersError
      } = await supabase.from('game_players').select(`
          *,
          profiles!game_players_user_id_fkey (
            full_name,
            avatar_url
          )
        `).eq('game_id', gameId).order('position');
      if (playersError) {
        console.error('Erro ao buscar jogadores:', playersError);
      }
      setGameData(game);
      setPlayers(allPlayers || []);
      setIsLoading(false);
      toast.success('Jogo carregado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao verificar acesso ao jogo:', error);
      setError('Erro ao carregar o jogo');
      setIsLoading(false);
    }
  };

  // Subscrição em tempo real para atualizações do jogo
  useEffect(() => {
    verifyGameAccess();
    if (!gameId) return;
    const gameChannel = supabase.channel(`game-${gameId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, payload => {
      console.log('Atualização do jogo:', payload);
      if (payload.new) {
        setGameData(payload.new as GameData);
      }
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_players',
      filter: `game_id=eq.${gameId}`
    }, payload => {
      console.log('Atualização dos jogadores:', payload);
      // Recarregar dados dos jogadores
      verifyGameAccess();
    }).subscribe();
    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameId, user]);
  const handleBackToLobby = () => {
    navigate('/');
  };
  if (isLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Carregando Jogo</h3>
            <p className="text-purple-200">Preparando o tabuleiro...</p>
          </CardContent>
        </Card>
      </div>;
  }
  if (error) {
    return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
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
      </div>;
  }
  if (!gameData) {
    return null;
  }
  return <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header com informações do jogo */}
        

        {/* Componente do jogo */}
        <GameRoom />
      </div>
    </div>;
};
export default Game;