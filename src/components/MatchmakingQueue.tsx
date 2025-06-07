
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Users, 
  AlertCircle, 
  RefreshCw,
  Clock,
  UserPlus,
  UserMinus 
} from 'lucide-react';

// Interfaces TypeScript
interface Player {
  id: string;
  username: string;
  avatar_url: string;
  joined_at: string;
}

interface QueueState {
  players: Player[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

// Mock do usuário atual
const CURRENT_USER: Player = {
  id: 'user-123',
  username: 'João Silva',
  avatar_url: '/placeholder.svg',
  joined_at: new Date().toISOString()
};

const MatchmakingQueue: React.FC = () => {
  const [queueState, setQueueState] = useState<QueueState>({
    players: [],
    isLoading: true,
    isPolling: false,
    error: null
  });

  const [isUserInQueue, setIsUserInQueue] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Função para buscar jogadores da fila
  const fetchQueuePlayers = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setQueueState(prev => ({ ...prev, isLoading: true, error: null }));
      } else {
        setQueueState(prev => ({ ...prev, isPolling: true, error: null }));
      }

      const { data, error } = await supabase
        .from('matchmaking_queue')
        .select(`
          user_id,
          created_at,
          users!inner(username)
        `)
        .eq('status', 'searching')
        .order('created_at', { ascending: true })
        .limit(4);

      if (error) throw error;

      // Transformar dados para o formato esperado
      const players: Player[] = (data || []).map((item: any) => ({
        id: item.user_id,
        username: item.users?.username || `Jogador ${item.user_id.slice(0, 8)}`,
        avatar_url: '/placeholder.svg',
        joined_at: item.created_at
      }));

      // Verificar se o usuário atual está na fila
      const userInQueue = players.some(player => player.id === CURRENT_USER.id);
      setIsUserInQueue(userInQueue);

      setQueueState(prev => ({
        ...prev,
        players,
        isLoading: false,
        isPolling: false,
        error: null
      }));

    } catch (error: any) {
      console.error('Erro ao buscar fila:', error);
      setQueueState(prev => ({
        ...prev,
        isLoading: false,
        isPolling: false,
        error: error.message || 'Falha ao conectar. Verifique sua rede.'
      }));
    }
  };

  // Função para entrar na fila
  const joinQueue = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: CURRENT_USER.id,
          status: 'searching'
        });

      if (error) throw error;

      // Atualizar estado local imediatamente
      setIsUserInQueue(true);
      await fetchQueuePlayers();

    } catch (error: any) {
      console.error('Erro ao entrar na fila:', error);
      setQueueState(prev => ({
        ...prev,
        error: error.message || 'Erro ao entrar na fila'
      }));
    } finally {
      setActionLoading(false);
    }
  };

  // Função para sair da fila
  const leaveQueue = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', CURRENT_USER.id);

      if (error) throw error;

      // Atualizar estado local imediatamente
      setIsUserInQueue(false);
      await fetchQueuePlayers();

    } catch (error: any) {
      console.error('Erro ao sair da fila:', error);
      setQueueState(prev => ({
        ...prev,
        error: error.message || 'Erro ao sair da fila'
      }));
    } finally {
      setActionLoading(false);
    }
  };

  // Polling automático a cada 5 segundos
  useEffect(() => {
    fetchQueuePlayers(true);

    const interval = setInterval(() => {
      fetchQueuePlayers();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Componente para slot de jogador ocupado
  const PlayerSlot: React.FC<{ player: Player; position: number }> = ({ player, position }) => (
    <div 
      className="animate-fade-in flex flex-col items-center p-4 bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-xl border border-purple-600/30 transition-all duration-300 hover:border-purple-500/50"
      role="listitem"
      aria-label={`Jogador ${position + 1}: ${player.username}`}
    >
      <Avatar className="w-16 h-16 mb-3 border-2 border-purple-400">
        <AvatarImage src={player.avatar_url} alt={`Avatar de ${player.username}`} />
        <AvatarFallback className="bg-purple-600 text-white font-semibold">
          {player.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-white font-medium text-sm text-center truncate w-full">
        {player.username}
      </span>
      <div className="flex items-center mt-2 text-green-400 text-xs">
        <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
        Online
      </div>
    </div>
  );

  // Componente para slot vazio
  const EmptySlot: React.FC<{ position: number }> = ({ position }) => (
    <div 
      className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-xl border border-gray-600/30 transition-all duration-300"
      role="listitem"
      aria-label={`Slot ${position + 1}: Aguardando jogador`}
    >
      <div className="w-16 h-16 mb-3 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center">
        <UserPlus className="w-8 h-8 text-gray-500" />
      </div>
      <span className="text-gray-400 text-sm text-center">
        Aguardando jogador...
      </span>
      <div className="flex items-center mt-2 text-gray-500 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Vazio
      </div>
    </div>
  );

  // Componente para skeleton de loading
  const LoadingSkeleton: React.FC = () => (
    <div className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-xl border border-gray-600/30">
      <Skeleton className="w-16 h-16 rounded-full mb-3" />
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );

  // Render do estado de erro
  if (queueState.error && queueState.isLoading) {
    return (
      <Card className="max-w-2xl mx-auto bg-gradient-to-br from-red-900/50 to-black/50 border-red-600/30">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Erro de Conexão</h3>
          <p className="text-red-200 mb-6">{queueState.error}</p>
          <Button 
            onClick={() => fetchQueuePlayers(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
            aria-label="Tentar conectar novamente"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-gradient-to-br from-purple-900/50 to-black/50 border-purple-600/30">
      <CardHeader className="text-center relative">
        <CardTitle className="text-white flex items-center justify-center gap-2">
          <Users className="w-6 h-6 text-purple-400" />
          Procurando Partida...
          {queueState.isPolling && (
            <Loader2 className="w-4 h-4 animate-spin text-purple-400 ml-2" />
          )}
        </CardTitle>
        <p className="text-purple-200 text-sm">
          {queueState.players.length}/4 jogadores na fila
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grid de slots de jogadores */}
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          role="list"
          aria-label="Lista de jogadores na fila"
        >
          {Array.from({ length: 4 }, (_, index) => {
            if (queueState.isLoading) {
              return <LoadingSkeleton key={index} />;
            }
            
            const player = queueState.players[index];
            return player ? (
              <PlayerSlot key={player.id} player={player} position={index} />
            ) : (
              <EmptySlot key={index} position={index} />
            );
          })}
        </div>

        {/* Informações da partida */}
        <div className="bg-purple-800/20 rounded-lg p-4 border border-purple-600/20">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <span className="text-purple-300">Taxa de entrada:</span>
              <div className="text-white font-semibold">R$ 1,10</div>
            </div>
            <div className="text-center">
              <span className="text-purple-300">Prêmio total:</span>
              <div className="text-green-400 font-semibold">R$ 4,00</div>
            </div>
          </div>
        </div>

        {/* Exibir erro não-crítico */}
        {queueState.error && !queueState.isLoading && (
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3 text-center">
            <p className="text-red-200 text-sm">{queueState.error}</p>
          </div>
        )}

        {/* Botão de ação */}
        <Button
          onClick={isUserInQueue ? leaveQueue : joinQueue}
          disabled={actionLoading || queueState.players.length >= 4 && !isUserInQueue}
          className={`w-full transition-all duration-300 ${
            isUserInQueue 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
          }`}
          aria-label={isUserInQueue ? 'Sair da fila de matchmaking' : 'Entrar na fila de matchmaking'}
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : isUserInQueue ? (
            <UserMinus className="w-4 h-4 mr-2" />
          ) : (
            <UserPlus className="w-4 h-4 mr-2" />
          )}
          {actionLoading 
            ? (isUserInQueue ? 'Saindo...' : 'Entrando...') 
            : (isUserInQueue ? 'Sair da Fila' : 'Entrar na Fila')
          }
        </Button>

        {/* Status da conexão */}
        <div className="flex items-center justify-center text-xs text-purple-300">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
          Conectado ao servidor
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
