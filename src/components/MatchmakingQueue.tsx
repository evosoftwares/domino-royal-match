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

  // Função para buscar jogadores da fila
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

      // Criar jogadores com dados básicos
      const players: QueuePlayer[] = queueData.map((queueItem, index) => {
        let displayName = `Jogador ${index + 1}`;
        let email = 'usuario@exemplo.com';
        let avatarUrl = '/placeholder.svg';

        // Se for o usuário atual, usar seus dados reais
        if (user && queueItem.user_id === user.id) {
          displayName = user.name || 
                       user.email?.split('@')[0] ||
                       'Você';
          email = user.email || 'seu@email.com';
          avatarUrl = '/placeholder.svg'; // Usando placeholder já que não temos avatar_url no tipo User
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

  // Função para entrar na fila
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

  // Polling automático a cada 3 segundos
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
      className="flex flex-col items-center p-4 bg-slate-900/50 rounded-xl border border-slate-600/30 transition-all duration-300"
      role="listitem"
      aria-label={`Slot ${position + 1} aguardando jogador`}
    >
      <div className="w-16 h-16 mb-3 rounded-full bg-slate-700/50 border-2 border-dashed border-slate-500/50 flex items-center justify-center">
        <UserPlus className="w-6 h-6 text-slate-400" />
      </div>
      <span className="text-slate-400 font-medium text-sm text-center">
        Aguardando jogador
      </span>
      <div className="flex items-center mt-2 text-slate-500 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Disponível
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-slate-700/50 shadow-2xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-3 text-slate-100 text-xl font-bold">
          <Users className="w-6 h-6 text-blue-400" />
          Fila de Matchmaking
          {queueState.isPolling && (
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
          )}
        </CardTitle>
        <div className="flex items-center justify-center gap-2 text-slate-300 text-sm mt-2">
          <span className="bg-slate-800/80 px-3 py-1 rounded-full border border-slate-600/50">
            {queueState.players.length}/4 jogadores
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Estado de carregamento */}
        {queueState.isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span>Carregando fila...</span>
            </div>
          </div>
        )}

        {/* Exibição de erro */}
        {queueState.error && (
          <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{queueState.error}</span>
          </div>
        )}

        {/* Grid de jogadores */}
        {!queueState.isLoading && (
          <div className="grid grid-cols-2 gap-4" role="list" aria-label="Lista de jogadores na fila">
            {Array.from({ length: 4 }).map((_, index) => {
              const player = queueState.players[index];
              return player ? (
                <PlayerSlot key={player.id} player={player} position={index} />
              ) : (
                <EmptySlot key={`empty-${index}`} position={index} />
              );
            })}
          </div>
        )}

        {/* Controles de ação */}
        <div className="flex flex-col gap-3 pt-4">
          {!isUserInQueue ? (
            <Button
              onClick={joinQueue}
              disabled={actionLoading || queueState.isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
            >
              {actionLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando na fila...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Entrar em Partida
                </div>
              )}
            </Button>
          ) : (
            <Button
              onClick={leaveQueue}
              disabled={actionLoading}
              variant="destructive"
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 font-semibold py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
            >
              {actionLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saindo da fila...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserMinus className="w-4 h-4" />
                  Sair da Fila
                </div>
              )}
            </Button>
          )}
        </div>

        {/* Informações adicionais */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
          <div className="text-center text-slate-300 text-sm space-y-1">
            <p className="font-medium">
              {queueState.players.length < 4 
                ? `Aguardando ${4 - queueState.players.length} jogador(es)`
                : 'Fila completa! Iniciando partida...'
              }
            </p>
            <p className="text-xs text-slate-400">
              A partida inicia automaticamente quando 4 jogadores estiverem prontos
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
