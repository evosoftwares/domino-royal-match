// src/hooks/useMatchmaking.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useNavigate } from 'react-router-dom';

// Tipos para clareza
interface QueuePlayer {
  id: string;
  full_name: string;
  avatar_url: string;
}

export const useMatchmaking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isInQueue, setIsInQueue] = useState(false);
  const [playersInQueue, setPlayersInQueue] = useState<QueuePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref para garantir que a criação do jogo seja chamada apenas uma vez
  const hasCalledStartGame = useRef(false);

  // Função para buscar o estado atual da fila e atualizar a UI
  const fetchQueueState = useCallback(async () => {
    const { data: queueEntries, error } = await supabase
      .from('matchmaking_queue')
      .select('user_id, profiles(id, full_name, avatar_url)')
      .eq('status', 'searching');

    if (error) {
      toast.error('Erro ao buscar a fila.');
      console.error(error);
      setPlayersInQueue([]);
      return;
    }
    
    // Mapeia os dados para o formato que a UI espera
    const players = queueEntries.map(entry => ({
      id: entry.profiles.id,
      ...entry.profiles
    })) as QueuePlayer[];
    
    setPlayersInQueue(players);
    if (user) {
      setIsInQueue(players.some(p => p.id === user.id));
    }
  }, [user]);

  // Efeito para verificar o estado inicial e se inscrever em atualizações
  useEffect(() => {
    setIsLoading(true);
    fetchQueueState().finally(() => setIsLoading(false));

    const channel = supabase
      .channel('matchmaking-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchmaking_queue' }, 
        () => fetchQueueState()
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, 
        (payload) => {
          // Se um novo jogo for criado, verifica se o usuário atual está nele
          if (user) {
            const playerIds = payload.new.players || [];
            if (playerIds.includes(user.id)) {
              toast.success('Partida encontrada! Redirecionando...');
              navigate(`/game2/${payload.new.id}`);
            }
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchQueueState, navigate]);


  // === LÓGICA DE GATILHO PARA INICIAR O JOGO (A CORREÇÃO PRINCIPAL) ===
  useEffect(() => {
    if (playersInQueue.length >= 4 && !hasCalledStartGame.current && user) {
      
      const playerIds = playersInQueue.map(p => p.id).sort();
      // O primeiro jogador na lista (ordenado por ID) fica responsável por chamar a função
      const isResponsible = user.id === playerIds[0];

      if (isResponsible) {
        hasCalledStartGame.current = true;
        
        const startGame = async () => {
          toast.info('Fila completa. Criando a partida...');
          const { error } = await supabase.functions.invoke('start-game', {
            body: { players: playerIds },
          });

          if (error) {
            toast.error(`Erro ao criar a partida: ${error.message}`);
            hasCalledStartGame.current = false; // Permite nova tentativa
          }
          // Se der certo, a subscrição acima vai redirecionar todos
        };
        startGame();
      }
    }
  }, [playersInQueue, user, navigate]);


  const joinQueue = async () => {
    if (!user) return;
    setActionLoading(true);
    // Usando upsert para evitar erros se o usuário já estiver na fila
    const { error } = await supabase.from('matchmaking_queue').upsert({ user_id: user.id, status: 'searching' });
    if (error) toast.error(error.message);
    else toast.success('Você entrou na fila!');
    setActionLoading(false);
  };

  const leaveQueue = async () => {
    if (!user) return;
    setActionLoading(true);
    const { error } = await supabase.from('matchmaking_queue').delete().eq('user_id', user.id);
    if (error) toast.error(error.message);
    else toast.info('Você saiu da fila.');
    setActionLoading(false);
  };

  return {
    isInQueue,
    playersInQueue,
    isLoading,
    joinQueue,
    leaveQueue,
    // Removi 'gameId' porque o redirecionamento agora é feito pela subscrição
  };
};

