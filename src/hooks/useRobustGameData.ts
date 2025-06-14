
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData } from '@/types/game';

interface UseRobustGameDataProps {
  gameId: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export const useRobustGameData = ({ gameId }: UseRobustGameDataProps) => {
  const { user } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWithRetry = useCallback(async (retryAttempt = 0): Promise<void> => {
    try {
      setError(null);
      
      if (retryAttempt > 0) {
        console.log(`Tentativa ${retryAttempt} de carregar dados do jogo`);
      }

      // Validação de entrada
      if (!gameId || !user) {
        throw new Error('ID do jogo ou usuário inválido');
      }

      // Fetch com timeout
      const gamePromise = supabase
        .from('games')
        .select('id, status, current_player_turn, board_state, prize_pool, created_at, updated_at')
        .eq('id', gameId)
        .single();

      const playersPromise = supabase
        .from('game_players')
        .select(`id, user_id, game_id, position, hand, profiles(full_name, avatar_url)`)
        .eq('game_id', gameId)
        .order('position');

      // Timeout de 10 segundos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao carregar dados')), 10000);
      });

      const [gameResult, playersResult] = await Promise.race([
        Promise.all([gamePromise, playersPromise]),
        timeoutPromise
      ]) as [any, any];

      const { data: game, error: gameError } = gameResult;
      const { data: gamePlayers, error: playersError } = playersResult;

      if (gameError) {
        throw new Error(`Erro ao carregar jogo: ${gameError.message}`);
      }

      if (playersError) {
        throw new Error(`Erro ao carregar jogadores: ${playersError.message}`);
      }

      if (!game) {
        throw new Error('Jogo não encontrado');
      }

      if (!gamePlayers) {
        throw new Error('Jogadores não encontrados');
      }

      // Verificar permissão
      if (!gamePlayers.some(p => p.user_id === user.id)) {
        throw new Error('Você não faz parte deste jogo');
      }

      setGameData(game);
      setPlayers(gamePlayers);
      setRetryCount(0);
      
      if (retryAttempt === 0) {
        toast.success('Dados do jogo carregados com sucesso!');
      } else {
        toast.success(`Reconectado após ${retryAttempt} tentativas`);
      }

    } catch (error: any) {
      console.error(`Erro na tentativa ${retryAttempt + 1}:`, error);
      
      if (retryAttempt < MAX_RETRIES) {
        setRetryCount(retryAttempt + 1);
        const delay = RETRY_DELAY * Math.pow(2, retryAttempt);
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchWithRetry(retryAttempt + 1);
        }, delay);
        
        if (retryAttempt === 0) {
          toast.error(`Erro ao carregar: ${error.message}. Tentando novamente...`);
        }
      } else {
        setError(error.message);
        toast.error(`Falha após ${MAX_RETRIES} tentativas: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId, user]);

  const retryManually = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    fetchWithRetry(0);
  }, [fetchWithRetry]);

  useEffect(() => {
    fetchWithRetry(0);
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchWithRetry]);

  return {
    gameData,
    players,
    isLoading,
    error,
    retryCount,
    retryManually,
    setGameData,
    setPlayers
  };
};
