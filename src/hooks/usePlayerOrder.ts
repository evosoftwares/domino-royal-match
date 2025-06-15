
import { useMemo } from 'react';
import { PlayerData } from '@/types/game';

interface UsePlayerOrderProps {
  players: PlayerData[];
  currentPlayerTurn?: string | null;
}

export const usePlayerOrder = ({ players, currentPlayerTurn }: UsePlayerOrderProps) => {
  // Ordenar jogadores corretamente pela posição
  const sortedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => a.position - b.position);
    console.log('🎯 Jogadores ordenados por posição:', sorted.map(p => ({
      position: p.position,
      user_id: p.user_id,
      name: p.profiles?.full_name || 'Sem nome'
    })));
    return sorted;
  }, [players]);

  // Encontrar o índice do jogador atual
  const currentPlayerIndex = useMemo(() => {
    if (!currentPlayerTurn) return -1;
    const index = sortedPlayers.findIndex(p => p.user_id === currentPlayerTurn);
    console.log('🎯 Índice do jogador atual:', index, 'para ID:', currentPlayerTurn);
    return index;
  }, [sortedPlayers, currentPlayerTurn]);

  // Calcular próximo jogador
  const nextPlayer = useMemo(() => {
    if (currentPlayerIndex === -1 || sortedPlayers.length === 0) return null;
    const nextIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
    const next = sortedPlayers[nextIndex];
    console.log('🎯 Próximo jogador será:', next?.profiles?.full_name, 'na posição:', next?.position);
    return next;
  }, [currentPlayerIndex, sortedPlayers]);

  // Verificar se a ordem está correta
  const isOrderValid = useMemo(() => {
    // Verificar se todas as posições são únicas e sequenciais
    const positions = sortedPlayers.map(p => p.position).sort((a, b) => a - b);
    const expectedPositions = Array.from({ length: positions.length }, (_, i) => i);
    
    const valid = positions.length === expectedPositions.length && 
                  positions.every((pos, index) => pos === expectedPositions[index]);

    if (!valid) {
      console.warn('⚠️ Ordem dos jogadores inválida:', {
        positions,
        expected: expectedPositions,
        players: sortedPlayers.map(p => ({ id: p.user_id, position: p.position }))
      });
    }

    return valid;
  }, [sortedPlayers]);

  // Debug info
  const debugInfo = useMemo(() => ({
    totalPlayers: sortedPlayers.length,
    currentPlayerTurn,
    currentPlayerIndex,
    nextPlayerId: nextPlayer?.user_id,
    isOrderValid,
    playersOrder: sortedPlayers.map(p => ({
      position: p.position,
      userId: p.user_id,
      name: p.profiles?.full_name || 'Sem nome',
      isCurrent: p.user_id === currentPlayerTurn
    }))
  }), [sortedPlayers, currentPlayerTurn, currentPlayerIndex, nextPlayer, isOrderValid]);

  return {
    sortedPlayers,
    currentPlayerIndex,
    nextPlayer,
    isOrderValid,
    debugInfo
  };
};
