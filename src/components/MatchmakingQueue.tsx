
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Importação dos componentes de UI e ícones
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, Clock, UserPlus, UserMinus, AlertCircle, RefreshCw } from 'lucide-react';

// --- Interfaces e Tipos ---
interface QueuePlayer {
  id: string;
  displayName: string;
  avatarUrl: string;
}

interface QueueState {
  players: QueuePlayer[];
  isLoading: boolean;
  error: string | null;
}

// --- Sub-componentes para a UI ---

const PlayerSlot: React.FC<{ player: QueuePlayer; isCurrentUser: boolean }> = ({ player, isCurrentUser }) => (
  <div className="animate-fade-in flex flex-col items-center p-4 bg-slate-800/90 rounded-xl border border-slate-700/50 transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-700/90">
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
      {isCurrentUser ? 'Você' : 'Online'}
    </div>
  </div>
);

const EmptySlot: React.FC = () => (
  <div className="flex flex-col items-center p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 transition-all duration-300">
    <div className="w-16 h-16 mb-3 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
      <UserPlus className="w-8 h-8 text-slate-500" />
    </div>
    <span className="text-slate-400 text-sm text-center">Aguardando...</span>
    <div className="flex items-center mt-2 text-slate-500 text-xs">
      <Clock className="w-3 h-3 mr-1" />
      Vazio
    </div>
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="flex flex-col items-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
    <Skeleton className="w-16 h-16 rounded-full mb-3 bg-slate-700" />
    <Skeleton className="h-4 w-20 mb-2 bg-slate-700" />
    <Skeleton className="h-3 w-16 bg-slate-700" />
  </div>
);

// --- Componente Principal ---
const MatchmakingQueue: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queueState, setQueueState] = useState<QueueState>({
    players: [],
    isLoading: true,
    error: null,
  });
  const [isUserInQueue, setIsUserInQueue] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const fetchQueueState = useCallback(async () => {
    try {
      setQueueState(prev => ({ ...prev, error: null }));
      
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id')
        .eq('status', 'searching')
        .eq('idjogopleiteado', 1)
        .order('created_at', { ascending: true })
        .limit(4);

      if (queueError) {
        console.error('Erro ao buscar fila:', queueError);
        throw queueError;
      }
      
      if (!queueData || queueData.length === 0) {
        setQueueState({ players: [], isLoading: false, error: null });
        setIsUserInQueue(false);
        return;
      }
      
      const userIds = queueData.map(item => item.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
        
      if (profilesError) {
        console.error('Erro ao buscar perfis:', profilesError);
        throw profilesError;
      }

      const profilesMap = new Map(profilesData.map(p => [p.id, p]));
      const players = queueData.map((queueItem): QueuePlayer => {
        const profile = profilesMap.get(queueItem.user_id);
        return {
          id: queueItem.user_id,
          displayName: profile?.full_name || 'Anônimo',
          avatarUrl: profile?.avatar_url || '',
        };
      });

      setQueueState({ players, isLoading: false, error: null });
      setIsUserInQueue(user ? players.some(player => player.id === user.id) : false);
      
      // Se chegamos a 4 jogadores, tentar criar o jogo
      if (players.length === 4) {
        console.log('4 jogadores na fila, tentando criar jogo...');
        try {
          const { data: gameResult } = await supabase.rpc('create_game_when_ready');
          console.log('Resultado da criação do jogo:', gameResult);
        } catch (error) {
          console.error('Erro ao tentar criar jogo:', error);
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar fila:', error);
      setQueueState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Falha ao carregar dados da fila.' 
      }));
    }
  }, [user]);

  const checkIfUserIsInNewGame = useCallback(async (gameId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) { 
        console.error('Erro ao verificar participação:', error); 
        return; 
      }
      
      if (data) {
        toast.success('Partida encontrada! Redirecionando...');
        setTimeout(() => navigate(`/game2/${gameId}`), 1500);
      }
    } catch (error) {
      console.error('Erro inesperado ao verificar jogo:', error);
    }
  }, [user, navigate]);

  // Sistema de polling a cada 5 segundos
  useEffect(() => {
    if (!user) return;

    const checkUserInActiveGame = async () => {
      try {
        const { data: activeGame, error } = await supabase
          .from('game_players')
          .select('game_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Erro ao verificar jogo ativo:', error);
          return false;
        }

        if (activeGame) {
          toast.info('Você já está em um jogo ativo! Redirecionando...');
          navigate(`/game2/${activeGame.game_id}`);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Erro inesperado ao verificar jogo ativo:', error);
        return false;
      }
    };
    
    checkUserInActiveGame().then(isInGame => {
      if (!isInGame) {
        // Buscar estado inicial
        fetchQueueState();
        
        // Configurar polling a cada 5 segundos
        pollingIntervalRef.current = setInterval(() => {
          fetchQueueState();
        }, 5000);
        
        // Canal de tempo real apenas para detectar novos jogos criados
        const channel = supabase
          .channel('game-creation')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'games' },
            (payload) => {
              console.log('Novo jogo detectado:', payload.new.id);
              checkIfUserIsInNewGame(payload.new.id);
            }
          )
          .subscribe();
        
        channelRef.current = channel;
      }
    });

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, navigate, checkIfUserIsInNewGame, fetchQueueState]);

  const joinQueue = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);

    try {
      const { data, error } = await supabase.rpc('join_matchmaking_queue');

      if (error) {
        toast.error('Erro ao entrar na fila.');
        console.error(error);
      } else {
        toast.success('Você entrou na fila!');
        // Buscar estado atualizado imediatamente
        await fetchQueueState();
      }
    } catch (error) {
      toast.error('Erro inesperado ao entrar na fila.');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);

    try {
      const { error } = await supabase.rpc('leave_matchmaking_queue');

      if (error) {
        toast.error('Erro ao sair da fila.');
        console.error(error);
      } else {
        toast.info('Você saiu da fila.');
        // Buscar estado atualizado imediatamente
        await fetchQueueState();
      }
    } catch (error) {
      toast.error('Erro inesperado ao sair da fila.');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };
  
  // --- Renderização da UI ---
  const { players, isLoading, error } = queueState;

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95">
        <CardHeader className="text-center p-4 border-b border-slate-700/50">
            <CardTitle className="text-slate-100">Carregando Sala...</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          {Array.from({ length: 4 }).map((_, index) => <LoadingSkeleton key={index} />)}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95 border-red-500/20">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-100 mb-2">Erro de Conexão</h3>
          <p className="text-red-300 mb-6">{error}</p>
          <Button onClick={fetchQueueState} variant="destructive">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-slate-900/95 border-slate-700/50 shadow-2xl">
      <CardHeader className="text-center p-4 border-b border-slate-700/50">
        <CardTitle className="text-slate-100 flex items-center justify-center gap-2 text-xl font-bold">
          <Users className="w-6 h-6 text-blue-400" />
          Procurando Partida
        </CardTitle>
        <p className="text-slate-300 text-sm font-medium">{players.length}/4 jogadores na fila</p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const player = players[index];
            return player ? (
              <PlayerSlot key={player.id} player={player} isCurrentUser={player.id === user?.id} />
            ) : (
              <EmptySlot key={index} />
            );
          })}
        </div>
        
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

        <Button
          onClick={isUserInQueue ? leaveQueue : joinQueue}
          disabled={!user || actionLoading || (players.length >= 4 && !isUserInQueue)}
          className={`w-full transition-all duration-300 font-semibold text-base py-3 ${
            isUserInQueue 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
          }`}
        >
          {actionLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : isUserInQueue ? (
            <UserMinus className="w-5 h-5 mr-2" />
          ) : (
            <UserPlus className="w-5 h-5 mr-2" />
          )}
          {actionLoading ? (isUserInQueue ? 'Saindo...' : 'Entrando...') : (isUserInQueue ? 'Sair da Fila' : 'Entrar na Fila')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
