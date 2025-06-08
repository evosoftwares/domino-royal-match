import React, { useState, useEffect, useCallback, useRef } from 'react'; // Importe o useRef
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// --- Componentes de UI e Ícones (sem alterações) ---
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, Clock, UserPlus, UserMinus, AlertCircle, RefreshCw } from 'lucide-react';

// --- Interfaces (sem alterações) ---
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

// --- Componente Principal Refatorado ---
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
  
  // O useRef é como uma "caixa" que pode guardar um valor e que sobrevive entre as renderizações.
  // Usaremos ele para garantir que o listener de tempo real sempre tenha a versão mais recente da nossa função.
  const fetchQueueStateRef = useRef<() => void>();

  const fetchQueueState = useCallback(async () => {
    // ... (o conteúdo desta função é o mesmo da versão anterior, sem alterações)
    try {
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id')
        .eq('status', 'searching')
        .order('created_at', { ascending: true })
        .limit(4);

      if (queueError) throw queueError;
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
        
      if (profilesError) throw profilesError;

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

    } catch (error: any) {
      console.error('Erro ao buscar fila:', error);
      setQueueState(prev => ({ ...prev, isLoading: false, error: 'Falha ao buscar dados da fila.' }));
    }
  }, [user]);

  // Este useEffect garante que a nossa "caixa" (ref) sempre tenha a versão mais atual da função fetchQueueState.
  useEffect(() => {
    fetchQueueStateRef.current = fetchQueueState;
  });

  const checkIfUserIsInNewGame = useCallback(async (gameId: string) => {
    // ... (esta função está correta e não precisa de alterações)
    if (!user) return;
    const { data, error } = await supabase.from('game_players').select('game_id').eq('game_id', gameId).eq('user_id', user.id).maybeSingle();
    if (error) { console.error('Erro ao verificar participação:', error); return; }
    if (data) {
      toast.success('Partida encontrada! Redirecionando...');
      setTimeout(() => navigate(`/game2/${gameId}`), 1500);
    }
  }, [user, navigate]);


  // Efeito Principal (Tempo Real e Carga Inicial) - COM A CORREÇÃO
  useEffect(() => {
    fetchQueueState(); // Carga inicial dos dados

    const channel = supabase
      .channel('public:matchmaking_queue') // Usar um nome de canal simples é uma boa prática
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => {
          console.log('Mudança na fila detectada. Chamando a função mais recente...');
          // A CORREÇÃO ESTÁ AQUI:
          // Em vez de chamar fetchQueueState() diretamente (que estaria "congelado no tempo"),
          // chamamos a função que está dentro da nossa "caixa" (ref), que é sempre a mais atual.
          fetchQueueStateRef.current?.();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        (payload) => {
          console.log('Novo jogo criado pelo backend...');
          checkIfUserIsInNewGame(payload.new.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkIfUserIsInNewGame]); // A dependência de fetchQueueState foi removida daqui


  // --- Funções de Ação do Usuário (com a atualização otimista confirmada) ---

  const joinQueue = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);

    const { error } = await supabase
      .from('matchmaking_queue')
      .upsert({ user_id: user.id, status: 'searching' });

    if (error) {
      toast.error('Erro ao entrar na fila.');
      console.error(error);
    } else {
      toast.success('Você entrou na fila!');
      // ATUALIZAÇÃO OTIMISTA: Força a atualização da UI imediatamente
      await fetchQueueState();
    }
    setActionLoading(false);
  };

  const leaveQueue = async () => {
    if (!user || actionLoading) return;
    setActionLoading(true);

    const { error } = await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao sair da fila.');
      console.error(error);
    } else {
      toast.info('Você saiu da fila.');
      // ATUALIZAÇÃO OTIMISTA: Força a atualização da UI imediatamente
      await fetchQueueState();
    }
    setActionLoading(false);
  };
  
  // --- Renderização da UI (JSX) ---
  // O seu código JSX daqui para baixo já está ótimo e não precisa de alterações.
  // ... (cole aqui o return completo com o Card, PlayerSlot, EmptySlot, etc.)
  // O código de renderização que você já tinha estava excelente.
  return (
    <Card className="max-w-2xl mx-auto bg-slate-900/95 border-slate-700/50 shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-slate-100 flex items-center justify-center gap-2 text-xl font-bold">
          <Users className="w-6 h-6 text-blue-400" />
          Procurando Partida
        </CardTitle>
        <p className="text-slate-300 text-sm font-medium">{queueState.players.length}/4 jogadores na fila</p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => {
            if (queueState.isLoading) {
              return (
                <div key={index} className="flex flex-col items-center p-4 bg-slate-800/50 rounded-xl">
                  <Skeleton className="w-16 h-16 rounded-full mb-3 bg-slate-700" />
                  <Skeleton className="h-4 w-20 bg-slate-700" />
                </div>
              );
            }
            const player = queueState.players[index];
            return player ? (
              <div key={player.id} className="flex flex-col items-center p-4 bg-slate-800/90 rounded-xl">
                <Avatar className="w-16 h-16 mb-3 border-2 border-blue-400">
                  <AvatarImage src={player.avatarUrl} alt={`Avatar de ${player.displayName}`} />
                  <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-slate-100 font-medium text-sm text-center truncate w-full">{player.displayName}</span>
                 <div className="flex items-center mt-2 text-emerald-400 text-xs font-medium">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                  {player.id === user?.id ? 'Você' : 'Online'}
                </div>
              </div>
            ) : (
              <div key={index} className="flex flex-col items-center p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <div className="w-16 h-16 mb-3 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                  <UserPlus className="w-8 h-8 text-slate-500" />
                </div>
                <span className="text-slate-400 text-sm">Aguardando...</span>
                <div className="flex items-center mt-2 text-slate-500 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Vazio
                </div>
              </div>
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
          disabled={!user || actionLoading || (queueState.players.length >= 4 && !isUserInQueue)}
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