import React, { useState, useEffect, useCallback } from 'react';
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

// --- Componente Principal ---
const MatchmakingQueue: React.FC = () => {
  // --- Hooks e Estados ---
  const { user } = useAuth();
  const navigate = useNavigate();

  const [queueState, setQueueState] = useState<QueueState>({
    players: [],
    isLoading: true, // Verdadeiro apenas para a carga inicial da página
    error: null,
  });

  const [isUserInQueue, setIsUserInQueue] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // Controla o estado de loading dos botões

  // --- Funções de Lógica ---

  /**
   * Busca o estado atual da fila de matchmaking no banco de dados
   * e atualiza a interface do usuário.
   */
  const fetchQueueState = useCallback(async () => {
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

  /**
   * Chamado quando um novo jogo é criado no backend.
   * Verifica se o usuário atual faz parte deste novo jogo e o redireciona.
   */
  const checkIfUserIsInNewGame = useCallback(async (gameId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('game_id', gameId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar participação no jogo:', error);
      return;
    }

    if (data) {
      console.log(`Usuário ${user.id} encontrado no novo jogo ${gameId}. Redirecionando...`);
      toast.success('Partida encontrada! Redirecionando...');
      setTimeout(() => navigate(`/game2/${gameId}`), 1500);
    }
  }, [user, navigate]);


  // --- Efeito Principal (Tempo Real e Carga Inicial) ---

  useEffect(() => {
    // 1. Verifica se o usuário já está em um jogo ativo ao carregar a página
    const checkUserInActiveGame = async () => {
      if (!user) return;
      const { data: activeGame } = await supabase
        .from('game_players')
        .select('game_id, games!inner(status)')
        .eq('user_id', user.id)
        .eq('games.status', 'active')
        .maybeSingle();

      if (activeGame) {
        toast.info('Você já está em um jogo ativo! Redirecionando...');
        navigate(`/game2/${activeGame.game_id}`);
        return true;
      }
      return false;
    };
    
    checkUserInActiveGame().then(isInGame => {
      if (!isInGame) {
        // 2. Se não estiver em jogo, busca o estado inicial da fila
        fetchQueueState();
      }
    });

    // 3. Configura os listeners de tempo real
    const channel = supabase
      .channel('public:matchmaking_queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => {
          console.log('Mudança na fila detectada. Atualizando UI.');
          fetchQueueState();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        (payload) => {
          console.log('Novo jogo criado pelo backend. Verificando se participo...');
          checkIfUserIsInNewGame(payload.new.id);
        }
      )
      .subscribe();

    // 4. Função de limpeza para remover o listener ao sair da página
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchQueueState, checkIfUserIsInNewGame, navigate]);


  // --- Funções de Ação do Usuário ---

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
  const { players, isLoading, error } = queueState;

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95">
        <CardHeader className="text-center"><CardTitle>Carregando...</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center p-4 bg-slate-800/50 rounded-xl">
              <Skeleton className="w-16 h-16 rounded-full mb-3 bg-slate-700" />
              <Skeleton className="h-4 w-20 bg-slate-700" />
            </div>
          ))}
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
      <CardHeader className="text-center">
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