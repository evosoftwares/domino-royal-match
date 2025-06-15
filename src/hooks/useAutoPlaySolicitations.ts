
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tables } from '@/integrations/supabase/types';

type SolicitacaoInsert = Tables<'solicitacoes'>['Insert'];

interface UseAutoPlaySolicitationsProps {
  gameId: string;
  isGameActive: boolean;
  timeLeft: number;
  allPlayerIds: string[];
}

export const useAutoPlaySolicitations = ({
  gameId,
  isGameActive,
  timeLeft,
  allPlayerIds
}: UseAutoPlaySolicitationsProps) => {
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSolicitationTime = useRef<number>(0);

  const createSolicitation = useCallback(async (targetUserId: string) => {
    if (!isGameActive || !user?.id) return;

    const now = Date.now();
    
    // Debounce: evitar criar solicitações muito frequentes
    if (now - lastSolicitationTime.current < 5000) {
      console.log('🚫 Debounce ativo, não criando solicitação');
      return;
    }

    try {
      console.log('📝 Criando solicitação de jogada automática para:', targetUserId);
      
      const solicitacao: SolicitacaoInsert = {
        game_id: gameId,
        user_id: targetUserId,
        tipo: 'auto_play',
        timeout_duration: 10
      };

      const { error } = await supabase
        .from('solicitacoes')
        .insert(solicitacao);

      if (error) {
        console.error('❌ Erro ao criar solicitação:', error);
      } else {
        console.log('✅ Solicitação criada com sucesso');
        lastSolicitationTime.current = now;
      }
    } catch (error) {
      console.error('❌ Erro de rede ao criar solicitação:', error);
    }
  }, [gameId, isGameActive, user?.id]);

  const scheduleAutoPlay = useCallback((targetUserId: string, delayMs: number) => {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    console.log(`⏰ Agendando jogada automática para ${targetUserId} em ${delayMs}ms`);

    timeoutRef.current = setTimeout(() => {
      createSolicitation(targetUserId);
    }, delayMs);
  }, [createSolicitation]);

  // Monitorar timer e criar solicitações quando necessário
  useEffect(() => {
    if (!isGameActive || allPlayerIds.length === 0) {
      return;
    }

    // Se restam 0 segundos, criar solicitação imediatamente para todos os jogadores
    if (timeLeft <= 0) {
      console.log('⚡ Timer expirou, criando solicitações para todos os jogadores');
      allPlayerIds.forEach(playerId => {
        createSolicitation(playerId);
      });
    }
    // Se restam 2 segundos ou menos, agendar criação de solicitação
    else if (timeLeft <= 2) {
      const delayMs = timeLeft * 1000;
      console.log(`🎯 Agendando solicitações em ${delayMs}ms`);
      
      allPlayerIds.forEach(playerId => {
        scheduleAutoPlay(playerId, delayMs);
      });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeLeft, isGameActive, allPlayerIds, createSolicitation, scheduleAutoPlay]);

  // Cleanup no desmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    createSolicitation,
    scheduleAutoPlay
  };
};
