import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
interface QueuePlayer {
  id: string;
  displayName: string;
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
  const navigate = useNavigate();
  const [queueState, setQueueState] = useState<QueueState>({
    players: [],
    isLoading: true,
    isPolling: false,
    error: null
  });

  const [isUserInQueue, setIsUserInQueue] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Subscrição em tempo real para mudanças na fila e criação de jogos
  useEffect(() => {
    const queueChannel = supabase
      .channel('matchmaking-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_queue'
        },
        async () => {
          await fetchQueuePlayers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games'
        },
        async (payload) => {
          console.log('Novo jogo criado:', payload);
          await checkIfUserInGame(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, [user]);

  // Verificar se o usuário está em um jogo específico
  const checkIfUserInGame = async (gameId: string) => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .single();

      if (data) {
        console.log('Usuário encontrado no jogo:', gameId);
        toast.success('Partida encontrada! Redirecionando...');
        
        setTimeout(() => {
          navigate(`/game/${gameId}`);
        }, 1500);
      }
    } catch (error) {
      console.error('Erro ao verificar se usuário está no jogo:', error);
    }
  };

  // Tentar criar jogo quando a fila estiver com 4 jogadores
  const tryCreateGame = async () => {
    try {
      console.log('Tentando criar jogo...');
      const { data, error } = await supabase.rpc('create_game_when_ready');
      
      if (error) {
        console.error('Erro ao tentar criar jogo:', error);
        return;
      }
      
      const response = data as any;
      
      if (response?.success) {
        console.log('Jogo criado com sucesso:', response.game_id);
        toast.success('Partida criada! Verificando participantes...');
        
        if (response.game_id) {
          await checkIfUserInGame(response.game_id);
        }
      } else {
        console.log('Não foi possível criar jogo:', response?.message);
      }
    } catch (error) {
      console.error('Erro ao tentar criar jogo:', error);
    }
  };

  // Função para buscar jogadores da fila com dados reais
  const fetchQueuePlayers = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setQueueState(prev => ({ ...prev, isLoading: true, error: null }));
      } else {
        setQueueState(prev => ({ ...prev, isPolling: true, error: null }));
      }

      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id, created_at')
        .eq('status', 'searching')
        .order('created_at', { ascending: true })
        .limit(4);

      if (queueError) throw queueError;

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
      
      const userIds = queueData.map(item => item.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
        
      if (profilesError) throw profilesError;

      const profilesMap = new Map(profilesData.map(p => [p.id, p]));

      const players = queueData.map((queueItem) => {
        const profile = profilesMap.get(queueItem.user_id);
        const displayName = profile?.full_name || 'Usuário Anônimo';
        const avatarUrl = profile?.avatar_url || 'https://img.freepik.com/free-psd/contact-icon-illustration-isolated_23-2151903337.jpg?semt=ais_hybrid&w=740';
        
        return {
          id: queueItem.user_id,
          displayName,
          avatarUrl,
          joinedAt: queueItem.created_at,
        };
      });

      const userInQueue = user ? players.some(player => player.id === user.id) : false;
      setIsUserInQueue(userInQueue);

      setQueueState(prev => ({
        ...prev,
        players,
        isLoading: false,
        isPolling: false,
        error: null
      }));

      if (players.length >= 4 && userInQueue) {
        console.log('Fila cheia com usuário atual. Tentando criar o jogo.');
        tryCreateGame();
      }

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

  // FUNÇÃO CORRIGIDA - Entrar na fila com melhor tratamento de duplicatas
  const joinQueue = async () => {
    if (!user) {
      setQueueState(prev => ({
        ...prev,
        error: 'Usuário não autenticado'
      }));
      return;
    }

    // Previne múltiplos cliques
    if (actionLoading) return;

    setActionLoading(true);
    setQueueState(prev => ({ ...prev, error: null }));

    try {
      // Usar upsert em vez de insert para evitar duplicatas
      const { data, error } = await supabase
        .from('matchmaking_queue')
        .upsert(
          {
            user_id: user.id,
            status: 'searching',
            created_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id',
            ignoreDuplicates: false
          }
        )
        .select();

      if (error) {
        // Se ainda assim der erro de duplicata, tratar especificamente
        if (error.code === '23505') {
          console.log('Usuário já está na fila, atualizando estado local...');
          setIsUserInQueue(true);
          await fetchQueuePlayers();
          toast.info('Você já está na fila!');
          return;
        }
        throw error;
      }

      console.log('Usuário adicionado à fila:', data);
      setIsUserInQueue(true);
      await fetchQueuePlayers();
      
      toast.success('Entrou na fila com sucesso!');

      // Tentar criar jogo após entrar na fila
      setTimeout(() => {
        tryCreateGame();
      }, 1000);

    } catch (error: any) {
      console.error('Erro ao entrar na fila:', error);
      
      // Tratamento específico para diferentes tipos de erro
      let errorMessage = 'Erro ao entrar na fila';
      
      if (error.code === '23505') {
        errorMessage = 'Você já está na fila';
        setIsUserInQueue(true);
        // Força atualização do estado
        setTimeout(() => fetchQueuePlayers(), 500);
      } else if (error.message?.includes('duplicate')) {
        errorMessage = 'Você já está na fila';
        setIsUserInQueue(true);
      } else {
        errorMessage = error.message || 'Erro desconhecido';
      }

      setQueueState(prev => ({
        ...prev,
        error: errorMessage
      }));
    } finally {
      setActionLoading(false);
    }
  };

  // Função para sair da fila
  const leaveQueue = async () => {
    if (!user) return;

    // Previne múltiplos cliques
    if (actionLoading) return;

    setActionLoading(true);
    setQueueState(prev => ({ ...prev, error: null }));

    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsUserInQueue(false);
      await fetchQueuePlayers();
      toast.success('Saiu da fila com sucesso!');

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
      if (!actionLoading) { // Não fazer polling durante ações
        fetchQueuePlayers();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [actionLoading]);

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