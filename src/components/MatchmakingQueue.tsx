
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, 
  Users, 
  AlertCircle, 
  RefreshCw,
  Clock,
  UserPlus,
  UserMinus 
} from 'lucide-react';

// Interfaces TypeScript específicas
interface AuthUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    name?: string;
  };
  created_at: string;
}

interface QueuePlayer {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  joinedAt: string;
}

interface QueueState {
  players: QueuePlayer[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
}

const MatchmakingQueue: React.FC = () => {
  const { user } = useAuth();
  const [queueState, setQueueState] = useState<QueueState>({
    players: [],
    isLoading: true,
    isPolling: false,
    error: null
  });

  const [isUserInQueue, setIsUserInQueue] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Função para buscar jogadores da fila com método alternativo
  const fetchQueuePlayers = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setQueueState(prev => ({ ...prev, isLoading: true, error: null }));
      } else {
        setQueueState(prev => ({ ...prev, isPolling: true, error: null }));
      }

      // Buscar IDs dos usuários na fila
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id, created_at')
        .eq('status', 'searching')
        .order('created_at', { ascending: true })
        .limit(4);

      if (queueError) throw queueError;

      // Se não há usuários na fila, limpar estado
      if (!queueData || queueData.length === 0) {
        setQueueState(prev => ({
          ...prev,
          players: [],
          isLoading: false,
          isPolling: false,
          error: null
        }));
        setIsUserInQueue(false);
        return;
      }

      // Método simplificado: Buscar dados do usuário atual se ele estiver na fila
      const players = queueData.map((queueItem, index) => {
        let displayName = `Usuário ${index + 1}`;
        let email = 'usuario@exemplo.com';
        let avatarUrl = '/placeholder.svg';

        // Se for o usuário atual, usar seus dados reais
        if (user && queueItem.user_id === user.id) {
          displayName = user.name || 
                       user.email?.split('@')[0] ||
                       'Você';
          email = user.email || 'seu@email.com';
          avatarUrl = '/placeholder.svg'; // Usar placeholder já que não temos avatar_url
        }

        return {
          id: queueItem.user_id,
          displayName,
          email,
          avatarUrl,
          joinedAt: queueItem.created_at
        };
      });

      // Verificar se o usuário atual está na fila
      const userInQueue = user ? players.some(player => player.id === user.id) : false;
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

  // Função para entrar na fila com verificação melhorada
  const joinQueue = async () => {
    if (!user) {
      setQueueState(prev => ({
        ...prev,
        error: 'Usuário não autenticado'
      }));
      return;
    }

    setActionLoading(true);
    try {
      // Verificar se já está na fila
      const { data: existingEntry, error: checkError } = await supabase
        .from('matchmaking_queue')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('status', 'searching')
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingEntry) {
        setQueueState(prev => ({
          ...prev,
          error: 'Você já está na fila'
        }));
        setIsUserInQueue(true);
        setActionLoading(false);
        return;
      }

      // Verificar se a fila não está cheia
      const { data: queueCount, error: countError } = await supabase
        .from('matchmaking_queue')
        .select('user_id', { count: 'exact' })
        .eq('status', 'searching');

      if (countError) throw countError;

      if (queueCount && queueCount.length >= 4) {
        setQueueState(prev => ({
          ...prev,
          error: 'Fila está cheia. Tente novamente em alguns segundos.'
        }));
        setActionLoading(false);
        return;
      }

      // Inserir na fila
      const { error: insertError } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          status: 'searching'
        });

      if (insertError) throw insertError;

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
    if (!user) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

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

  // Polling automático a cada 3 segundos (reduzido para melhor UX)
  useEffect(() => {
    fetchQueuePlayers(true);

    const interval = setInterval(() => {
      fetchQueuePlayers();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Limpar erros após 5 segundos
  useEffect(() => {
    if (queueState.error && !queueState.isLoading) {
      const timer = setTimeout(() => {
        setQueueState(prev => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [queueState.error, queueState.isLoading]);

  // Componente para slot de jogador ocupado
  const PlayerSlot: React.FC<{ player: QueuePlayer; position: number }> = ({ player, position }) => (
    <div 
      className="animate-fade-in flex flex-col items-center p-4 bg-slate-800/90 rounded-xl border border-slate-700/50 transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-700/90"
      role="listitem"
      aria-label={`Jogador ${position + 1}: ${player.displayName}`}
    >
      <Avatar className="w-16 h-16 mb-3 border-2 border-blue-400">
        <AvatarImage src={player.avatarUrl} alt={`Avatar de ${player.displayName}`} />
        <AvatarFallback className="bg-blue-600 text-white font-semibold">
          {player.displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-slate-100 font-medium text-sm text-center truncate w-full">
        {player.displayName}
      </span>
      <div className="flex items-center mt-2 text-emerald-400 text-xs font-medium">
        <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
        {player.id === user?.id ? 'Você' : 'Online'}
      </div>
    </div>
  );

  // Componente para slot vazio
  const EmptySlot: React.FC<{ position: number }> = ({ position }) => (
    <div 
      className="flex flex-col items-center p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 transition-all duration-300"
      role="listitem"
      aria-label={`Slot ${position + 1}: Aguardando jogador`}
    >
      <div className="w-16 h-16 mb-3 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
        <UserPlus className="w-8 h-8 text-slate-500" />
      </div>
      <span className="text-slate-400 text-sm text-center">
        Aguardando...
      </span>
      <div className="flex items-center mt-2 text-slate-500 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Vazio
      </div>
    </div>
  );

  // Componente para skeleton de loading
  const LoadingSkeleton: React.FC = () => (
    <div className="flex flex-col items-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
      <Skeleton className="w-16 h-16 rounded-full mb-3 bg-slate-700" />
      <Skeleton className="h-4 w-20 mb-2 bg-slate-700" />
      <Skeleton className="h-3 w-16 bg-slate-700" />
    </div>
  );

  // Render do estado de erro crítico
  if (queueState.error && queueState.isLoading) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95 border-red-500/20 shadow-xl">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Erro de Conexão</h3>
          <p className="text-red-300 mb-6">{queueState.error}</p>
          <Button 
            onClick={() => fetchQueuePlayers(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white font-medium"
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
    <Card className="max-w-2xl mx-auto bg-slate-900/95 border-slate-700/50 shadow-2xl">
      <CardHeader className="text-center relative bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-b border-slate-700/50">
        <CardTitle className="text-slate-100 flex items-center justify-center gap-2 text-xl font-bold">
          <Users className="w-6 h-6 text-blue-400" />
          Procurando Partida...
          {queueState.isPolling && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-2" />
          )}
        </CardTitle>
        <p className="text-slate-300 text-sm font-medium">
          {queueState.players.length}/4 jogadores na fila
        </p>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
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
        <div className="bg-slate-800/70 rounded-lg p-4 border border-slate-700/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <span className="text-slate-400 font-medium">Taxa de entrada:</span>
              <div className="text-slate-100 font-bold text-lg">R$ 1,10</div>
            </div>
            <div className="text-center">
              <span className="text-slate-400 font-medium">Prêmio total:</span>
              <div className="text-emerald-400 font-bold text-lg">R$ 4,00</div>
            </div>
          </div>
        </div>

        {/* Exibir erro não-crítico */}
        {queueState.error && !queueState.isLoading && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
            <p className="text-red-300 text-sm font-medium">{queueState.error}</p>
          </div>
        )}

        {/* Botão de ação */}
        <Button
          onClick={isUserInQueue ? leaveQueue : joinQueue}
          disabled={!user || actionLoading || (queueState.players.length >= 4 && !isUserInQueue)}
          className={`w-full transition-all duration-300 font-semibold text-base py-3 ${
            isUserInQueue 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-blue-500/25'
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
        <div className="flex items-center justify-center text-xs text-slate-400 font-medium">
          <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
          Conectado • Atualizando a cada 3s
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
