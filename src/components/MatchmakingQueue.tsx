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

// Interfaces TypeScript
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

  // Subscrição em tempo real para mudanças
  useEffect(() => {
    const queueChannel = supabase
      .channel('matchmaking-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        () => fetchQueuePlayers()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'games' },
        (payload) => checkIfUserInGame(payload.new.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, [user]);

  // Verifica se o usuário foi incluído em um jogo e o redireciona
  const checkIfUserInGame = async (gameId: string) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('game_players')
        .select('user_id')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .maybeSingle(); // Usar maybeSingle() é mais robusto

      if (data) {
        toast.success('Partida encontrada! Redirecionando...');
        setTimeout(() => navigate(`/game/${gameId}`), 1500);
      }
    } catch (error) {
      console.error('Erro ao verificar se o usuário está no jogo:', error);
    }
  };

  // Função para buscar os jogadores na fila (agora sem lógica de criação de jogo)
  const fetchQueuePlayers = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setQueueState(prev => ({ ...prev, isLoading: true, error: null }));
    } else {
      setQueueState(prev => ({ ...prev, isPolling: true, error: null }));
    }

    try {
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id, created_at')
        .eq('status', 'searching')
        .order('created_at', { ascending: true })
        .limit(4);

      if (queueError) throw queueError;
      
      if (!queueData || queueData.length === 0) {
        setQueueState({ players: [], isLoading: false, isPolling: false, error: null });
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
      const players = queueData.map((item) => {
        const profile = profilesMap.get(item.user_id);
        return {
          id: item.user_id,
          displayName: profile?.full_name || 'Usuário Anônimo',
          avatarUrl: profile?.avatar_url || '/placeholder.svg',
          joinedAt: item.created_at,
        };
      });

      setIsUserInQueue(user ? players.some(p => p.id === user.id) : false);
      setQueueState({ players, isLoading: false, isPolling: false, error: null });

    } catch (error: any) {
      console.error('Erro ao buscar fila:', error);
      setQueueState(prev => ({ ...prev, isLoading: false, isPolling: false, error: error.message }));
    }
  };
  
  // ✅ REVISADO: Função para entrar na fila, agora chama uma única função RPC "inteligente"
  const joinQueue = async () => {
    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }

    setActionLoading(true);
    try {
      // Chama a função "tudo em um" que criamos no backend
      const { data, error } = await supabase.rpc('join_and_create_game_if_ready');

      if (error) throw error;

      const response = data as any;
      if (response.success) {
        // Apenas mostra a mensagem de sucesso do backend.
        // O redirecionamento e a atualização da UI ocorrerão automaticamente
        // pela assinatura em tempo real, que chama fetchQueuePlayers e checkIfUserInGame.
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
    } catch (error: any) {
      console.error('Erro ao processar fila:', error);
      toast.error(error.message || 'Ocorreu um erro ao entrar na fila.');
    } finally {
      setActionLoading(false);
    }
  };

  // Função para sair da fila
  const leaveQueue = async () => {
    // ... (Esta função pode permanecer como está)
  };

  // Efeitos para carregar dados e limpar erros
  useEffect(() => {
    fetchQueuePlayers(true);
    const interval = setInterval(() => fetchQueuePlayers(), 5000); // Polling pode ser menos frequente agora
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (queueState.error) {
      const timer = setTimeout(() => setQueueState(prev => ({ ...prev, error: null })), 5000);
      return () => clearTimeout(timer);
    }
  }, [queueState.error]);

  // ... (Restante do seu código JSX para renderização pode permanecer o mesmo)
  // ... (PlayerSlot, EmptySlot, LoadingSkeleton, return ( <Card> ... </Card> ))
  
  return (
    // Seu JSX aqui
  );
};

export default MatchmakingQueue;