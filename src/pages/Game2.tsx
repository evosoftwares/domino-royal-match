
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Game2Room from '@/components/Game2Room';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameData, PlayerData } from '@/types/game';

const Game2: React.FC = () => {
  const { gameId } = useParams<{ gameId: string; }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBackToLobby = () => {
    navigate('/');
  };

  const fetchInitialData = useCallback(async () => {
    if (!gameId || !user) {
      setError('ID do jogo ou usuário inválido.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !game) {
        toast.error('Jogo não encontrado ou acesso negado.');
        setError('Jogo não encontrado.');
        return;
      }
      
      const { data: gamePlayers, error: playersError } = await supabase
        .from('game_players')
        .select(`*, profiles(full_name, avatar_url)`)
        .eq('game_id', gameId)
        .order('position');

      if (playersError) {
        toast.error('Erro ao carregar os jogadores.');
        setError('Não foi possível carregar os jogadores.');
        return;
      }
      
      if (!gamePlayers.some(p => p.user_id === user.id)) {
        toast.error("Você não faz parte deste jogo.");
        setError("Acesso negado.");
        navigate('/');
        return;
      }
      
      setGameData(game);
      setPlayers(gamePlayers);
      toast.success(`Bem-vindo ao jogo!`);

    } catch (e: any) {
      console.error("Erro ao carregar o jogo:", e);
      setError('Ocorreu um erro inesperado.');
      toast.error('Falha ao carregar o jogo.');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, user, navigate]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!gameId) return;

    const gameChannel: RealtimeChannel = supabase.channel(`game2:${gameId}`);

    const gameSubscription = gameChannel.on<GameData>(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => {
        setGameData(payload.new as GameData);
        toast.info("O estado do jogo foi atualizado.");
      }
    );

    const playersSubscription = gameChannel.on<PlayerData>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newPlayer = payload.new as PlayerData;
          if (!newPlayer.profiles) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', newPlayer.user_id)
              .single();
            newPlayer.profiles = profileData;
          }
          setPlayers(currentPlayers => [...currentPlayers, newPlayer]);
          toast.info(`${newPlayer.profiles?.full_name || 'Novo jogador'} entrou no jogo.`);
        } else if (payload.eventType === 'UPDATE') {
          setPlayers(currentPlayers => currentPlayers.map(p => p.id === payload.new.id ? payload.new as PlayerData : p));
        } else if (payload.eventType === 'DELETE') {
           setPlayers(currentPlayers => currentPlayers.filter(p => p.id !== (payload.old as PlayerData).id));
        }
      }
    );

    gameChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Conectado ao canal do jogo 2.');
      }
    });

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameId]);

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
        <Game2Room gameData={gameData} players={players} />
      </div>
    </div>
  );
};

export default Game2;
