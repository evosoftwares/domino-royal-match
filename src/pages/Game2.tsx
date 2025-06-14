
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Game2Room from '@/components/Game2Room';
import { toast } from 'sonner';
import { Loader2, AlertCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GameData, PlayerData } from '@/types/game';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRobustGameData } from '@/hooks/useRobustGameData';
import ErrorBoundary from '@/components/ErrorBoundary';

const Game2: React.FC = () => {
  const { gameId } = useParams<{ gameId: string; }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isLandscape, setIsLandscape] = useState(false);

  const {
    gameData,
    players,
    isLoading,
    error,
    retryCount,
    retryManually,
    setGameData,
    setPlayers
  } = useRobustGameData({ gameId: gameId || '' });

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleBackToLobby = () => {
    navigate('/');
  };

  // Realtime subscriptions otimizadas
  useEffect(() => {
    if (!gameId || !gameData) return;

    let gameChannel: RealtimeChannel | null = null;

    try {
      gameChannel = supabase.channel(`game2:${gameId}`);

      const gameSubscription = gameChannel.on<GameData>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          console.log('Game state updated:', payload.new);
          setGameData(payload.new as GameData);
          toast.info("O estado do jogo foi atualizado.");
        }
      );

      const playersSubscription = gameChannel.on<PlayerData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        async (payload) => {
          try {
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
              setPlayers(currentPlayers => 
                currentPlayers.map(p => p.id === payload.new.id ? payload.new as PlayerData : p)
              );
            } else if (payload.eventType === 'DELETE') {
              setPlayers(currentPlayers => 
                currentPlayers.filter(p => p.id !== (payload.old as PlayerData).id)
              );
            }
          } catch (error) {
            console.error('Erro ao processar atualização de jogador:', error);
          }
        }
      );

      gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Conectado ao canal do jogo 2.');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Erro no canal realtime');
          toast.error('Erro de conexão em tempo real');
        }
      });
    } catch (error) {
      console.error('Erro ao configurar realtime:', error);
    }

    return () => {
      if (gameChannel) {
        supabase.removeChannel(gameChannel);
      }
    };
  }, [gameId, gameData, setGameData, setPlayers]);

  // Tela para forçar rotação em mobile
  if (isMobile && !isLandscape) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center p-4">
        <Card className="max-w-sm mx-auto bg-slate-900/95 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <RotateCcw className="w-24 h-24 text-purple-400 mx-auto mb-6 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-100 mb-4">Gire seu dispositivo</h3>
            <p className="text-purple-200 mb-6">
              Para uma melhor experiência de jogo, por favor gire seu dispositivo para o modo paisagem.
            </p>
            <div className="text-4xl mb-4">📱➡️📱</div>
            <Button onClick={handleBackToLobby} variant="outline" className="bg-purple-600/20 border-purple-400/50 text-purple-300">
              Voltar ao Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameId || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-red-500/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Erro de Configuração</h3>
            <p className="text-red-300 mb-6">ID do jogo ou usuário inválido</p>
            <Button onClick={handleBackToLobby} variant="destructive">
              Voltar ao Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-slate-900/95 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Carregando Jogo</h3>
            <p className="text-purple-200">Preparando o tabuleiro...</p>
            {retryCount > 0 && (
              <p className="text-orange-300 mt-2 text-sm">
                Tentativa {retryCount}/3...
              </p>
            )}
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
            <div className="space-y-3">
              <Button onClick={retryManually} className="w-full bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button onClick={handleBackToLobby} variant="outline" className="w-full">
                Voltar ao Lobby
              </Button>
            </div>
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
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
        <div className="container mx-auto px-4 py-8">
          <Game2Room gameData={gameData} players={players} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Game2;
