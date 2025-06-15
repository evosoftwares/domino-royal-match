
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Tables } from '@/integrations/supabase/types';

type Solicitacao = Tables<'solicitacoes'>;

interface UseSolicitationsMonitorProps {
  gameId: string;
  isActive: boolean;
}

export const useSolicitationsMonitor = ({
  gameId,
  isActive
}: UseSolicitationsMonitorProps) => {
  const [pendingSolicitations, setPendingSolicitations] = useState<Solicitacao[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Solicitacao[]>([]);

  const fetchSolicitations = useCallback(async () => {
    if (!isActive || !gameId) return;

    try {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*')
        .eq('game_id', gameId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar solicitações:', error);
        return;
      }

      const pending = data?.filter(s => s.status === 'pending') || [];
      const processing = data?.filter(s => s.status === 'processing') || [];

      setPendingSolicitations(pending);
      setProcessingCount(processing.length);

      if (pending.length > 0 || processing.length > 0) {
        console.log(`📊 Solicitações: ${pending.length} pendentes, ${processing.length} processando`);
      }
    } catch (error) {
      console.error('❌ Erro de rede ao buscar solicitações:', error);
    }
  }, [gameId, isActive]);

  // Buscar solicitações iniciais
  useEffect(() => {
    fetchSolicitations();
  }, [fetchSolicitations]);

  // Monitorar mudanças em tempo real
  useEffect(() => {
    if (!isActive || !gameId) return;

    let channel: RealtimeChannel;

    try {
      channel = supabase.channel(`solicitations:${gameId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'solicitacoes',
            filter: `game_id=eq.${gameId}`
          },
          (payload) => {
            console.log('🔄 Mudança em solicitação:', payload);

            if (payload.eventType === 'INSERT') {
              const newSolicitation = payload.new as Solicitacao;
              if (newSolicitation.status === 'pending') {
                setPendingSolicitations(prev => [...prev, newSolicitation]);
              } else if (newSolicitation.status === 'processing') {
                setProcessingCount(prev => prev + 1);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedSolicitation = payload.new as Solicitacao;
              
              if (updatedSolicitation.status === 'processing') {
                setPendingSolicitations(prev => prev.filter(s => s.id !== updatedSolicitation.id));
                setProcessingCount(prev => prev + 1);
              } else if (updatedSolicitation.status === 'completed') {
                setPendingSolicitations(prev => prev.filter(s => s.id !== updatedSolicitation.id));
                setProcessingCount(prev => Math.max(0, prev - 1));
                
                // Adicionar aos recentemente completados
                setRecentlyCompleted(prev => {
                  const updated = [updatedSolicitation, ...prev.slice(0, 4)]; // Manter apenas 5 mais recentes
                  return updated;
                });
              } else if (updatedSolicitation.status === 'failed') {
                setPendingSolicitations(prev => prev.filter(s => s.id !== updatedSolicitation.id));
                setProcessingCount(prev => Math.max(0, prev - 1));
                console.warn('⚠️ Solicitação falhou:', updatedSolicitation.error_message);
              }
            }
          }
        )
        .subscribe();

      console.log('🎧 Monitoramento de solicitações ativo para jogo:', gameId);

    } catch (error) {
      console.error('❌ Erro ao configurar monitoramento:', error);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log('🔇 Monitoramento de solicitações desativado');
      }
    };
  }, [gameId, isActive]);

  // Limpar dados quando jogo não está ativo
  useEffect(() => {
    if (!isActive) {
      setPendingSolicitations([]);
      setProcessingCount(0);
      setRecentlyCompleted([]);
    }
  }, [isActive]);

  return {
    pendingSolicitations,
    processingCount,
    recentlyCompleted,
    totalPendingCount: pendingSolicitations.length + processingCount,
    refresh: fetchSolicitations
  };
};
