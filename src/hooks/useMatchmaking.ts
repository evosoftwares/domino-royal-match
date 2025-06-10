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
  const [actionLoading, setActionLoading] = useState(false);
  
  // Ref para garantir que a criação do jogo seja chamada apenas uma vez
  const hasCalledStartGame = useRef(false);
  const gameCreationLock = useRef(false);

  // Função para buscar o estado atual da fila e atualizar a UI
  const fetchQueueState = useCallback(async () => {
    try {
      // Primeiro, busca as entradas da fila
      const { data: queueEntries, error: queueError } = await supabase
        .from('matchmaking_queue')
        .select('user_id')
        .eq('status', 'searching');

      if (queueError) {
        toast.error('Erro ao buscar a fila.');
        console.error(queueError);
        setPlayersInQueue([]);
        return;
      }

      if (!queueEntries || queueEntries.length === 0) {
        setPlayersInQueue([]);
        setIsInQueue(false);
        return;
      }

      // Depois, busca os perfis dos usuários na fila
      const userIds = queueEntries.map(entry => entry.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue with basic user IDs if profile fetch fails
        const basicPlayers = queueEntries.map(entry => ({
          id: entry.user_id,
          full_name: 'Usuário',
          avatar_url: ''
        })) as QueuePlayer[];
        setPlayersInQueue(basicPlayers);
      } else {
        // Mapeia os dados para o formato que a UI espera
        const players = (profiles || []).map(profile => ({
          id: profile.id,
          full_name: profile.full_name || 'Usuário',
          avatar_url: profile.avatar_url || ''
        })) as QueuePlayer[];
        
        setPlayersInQueue(players);
      }
      
      if (user) {
        setIsInQueue(userIds.includes(user.id));
      }
    } catch (error) {
      console.error('Error fetching queue state:', error);
      toast.error('Erro inesperado ao buscar a fila.');
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
              hasCalledStartGame.current = false;
              gameCreationLock.current = false;
              navigate(`/game2/${payload.new.id}`);
            }
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchQueueState, navigate]);

  useEffect(() => {
    if (playersInQueue.length >= 4 && !hasCalledStartGame.current && !gameCreationLock.current && user) {
      
      const playerIds = playersInQueue.map(p => p.id).sort();
      // O primeiro jogador na lista (ordenado por ID) fica responsável por chamar a função
      const isResponsible = user.id === playerIds[0];

      if (isResponsible) {
        gameCreationLock.current = true;
        hasCalledStartGame.current = true;
        
        const startGame = async () => {
          try {
            toast.info('Fila completa. Criando a partida...');
            
            // Primeiro, criar o jogo
            const { data: gameData, error: gameError } = await supabase.functions.invoke('start-game', {
              body: { players: playerIds },
            });

            if (gameError) {
              toast.error(`Erro ao criar a partida: ${gameError.message}`);
              hasCalledStartGame.current = false;
              gameCreationLock.current = false;
              return;
            }

            // O jogo foi criado com sucesso
            // A primeira peça será jogada automaticamente pelo trigger do banco
            if (gameData && gameData.gameId) {
              console.log('Jogo criado com sucesso! ID:', gameData.gameId);
              console.log('A primeira peça será jogada automaticamente pelo trigger do banco.');
              toast.success('Jogo criado! A primeira peça será jogada automaticamente.');
            }
            
          } catch (error: any) {
            console.error('Erro inesperado ao criar jogo:', error);
            toast.error(`Erro inesperado: ${error.message}`);
            hasCalledStartGame.current = false;
            gameCreationLock.current = false;
          }
        };
        
        setTimeout(startGame, 100);
      }
    }
  }, [playersInQueue, user, navigate]);

  const joinQueue = async () => {
    if (!user) return;
    setActionLoading(true);
    
    try {
      // Usando upsert para evitar erros se o usuário já estiver na fila
      const { error } = await supabase
        .from('matchmaking_queue')
        .upsert({ user_id: user.id, status: 'searching' });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Você entrou na fila!');
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error('Erro inesperado ao entrar na fila.');
    } finally {
      setActionLoading(false);
    }
  };

  const leaveQueue = async () => {
    if (!user) return;
    setActionLoading(true);
    
    try {
      const { error } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.info('Você saiu da fila.');
        hasCalledStartGame.current = false;
        gameCreationLock.current = false;
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      toast.error('Erro inesperado ao sair da fila.');
    } finally {
      setActionLoading(false);
    }
  };

  return {
    isInQueue,
    playersInQueue,
    isLoading,
    actionLoading,
    joinQueue,
    leaveQueue,
  };
};

