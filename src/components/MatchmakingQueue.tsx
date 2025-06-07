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

      // Método 1: Tentar usar RPC primeiro
      let players: QueuePlayer[] = [];
      
      try {
        const userIds = queueData.map(item => item.user_id);
        
        // Tentar RPC com tipagem correta
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_users_by_ids', { 
            user_ids: userIds 
          }) as { data: AuthUser[] | null, error: any };

        if (!rpcError && rpcData) {
          // Combinar dados da fila com dados dos usuários via RPC
          players = queueData.map((queueItem, index) => {
            const userInfo = rpcData.find((u: AuthUser) => u.id === queueItem.user_id);
            
            const displayName = userInfo?.user_metadata?.full_name || 
                              userInfo?.user_metadata?.name ||
                              userInfo?.email?.split('@')[0] ||
                              `Usuário ${index + 1}`;

            return {
              id: queueItem.user_id,
              displayName,
              email: userInfo?.email || 'email@exemplo.com',
              avatarUrl: userInfo?.user_metadata?.avatar_url || '/placeholder.svg',
              joinedAt: queueItem.created_at
            };
          });
        } else {
          throw new Error('RPC falhou');
        }
      } catch (rpcError) {
        console.warn('RPC get_users_by_ids falhou, usando método alternativo:', rpcError);
        
        // Método 2: Buscar dados do usuário atual se ele estiver na fila
        players = queueData.map((queueItem, index) => {
          let displayName = `Usuário ${index + 1}`;
          let email = 'usuario@exemplo.com';
          let avatarUrl = '/placeholder.svg';

          // Se for o usuário atual, usar seus dados reais
          if (user && queueItem.user_id === user.id) {
            displayName = user.user_metadata?.full_name || 
                         user.user_metadata?.name ||
                         user.email?.split('@')[0] ||
                         'Você';
            email = user.email || 'seu@email.com';
            avatarUrl = user.user_metadata?.avatar_url || '/placeholder.svg';
          }

          return {
            id: queueItem.user_id,
            displayName,
            email,
            avatarUrl,
            joinedAt: queueItem.created_at
          };
        });
      }

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
      </div