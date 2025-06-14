
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData } from '@/types/game';
import { useGameStateRecovery } from './useGameStateRecovery';

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
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    detectStateCorruption,
    saveLastKnownGoodState,
    attemptStateRecovery,
    isRecovering,
    recoveryAttempts,
    resetRecoveryState,
    hasBackup
  } = useGameStateRecovery();

  const fetchWithRetry = useCallback(async (retryAttempt = 0): Promise<void> => {
    try {
      setError(null);
      
      if (retryAttempt > 0) {
        console.log(`Tentativa ${retryAttempt} de carregar dados do jogo`);
      }

      if (!gameId || !user) {
        throw new Error('ID do jogo ou usuário inválido');
      }

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

      if (!gamePlayers.some(p => p.user_id === user.id)) {
        throw new Error('Você não faz parte deste jogo');
      }

      // Detectar corrupção de estado ANTES de aplicar
      const corruption = detectStateCorruption(game, gamePlayers);
      
      if (corruption.hasCorruptedState && corruption.confidence > 0.8) {
        console.warn('🚨 Estado corrompido detectado:', corruption);
        setShowRecoveryDialog(true);
        
        // Tentar recuperação automática
        const recovered = await attemptStateRecovery(gameId, corruption);
        if (recovered.game) {
          setGameData(recovered.game);
          setPlayers(recovered.players.length > 0 ? recovered.players : gamePlayers);
        } else {
          setGameData(game);
          setPlayers(gamePlayers);
        }
      } else {
        // Estado válido - salvar como backup e aplicar
        saveLastKnownGoodState(game, gamePlayers);
        setGameData(game);
        setPlayers(gamePlayers);
      }

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
  }, [gameId, user, detectStateCorruption, saveLastKnownGoodState, attemptStateRecovery]);

  const retryManually = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);
    resetRecoveryState();
    setShowRecoveryDialog(false);
    fetchWithRetry(0);
  }, [fetchWithRetry, resetRecoveryState]);

  const handleRecovery = useCallback(async (useBackup: boolean) => {
    if (!gameData) return;

    const corruption = detectStateCorruption(gameData, players);
    const recovered = await attemptStateRecovery(gameId, corruption, {
      forceRefresh: !useBackup,
      resetCache: true,
      fallbackToLastKnown: useBackup
    });

    if (recovered.game) {
      setGameData(recovered.game);
      setPlayers(recovered.players.length > 0 ? recovered.players : players);
      setShowRecoveryDialog(false);
    }
  }, [gameData, players, detectStateCorruption, attemptStateRecovery, gameId]);

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
    setPlayers,
    // Novos recursos de recuperação
    showRecoveryDialog,
    corruption: gameData ? detectStateCorruption(gameData, players) : null,
    isRecovering,
    recoveryAttempts,
    hasBackup,
    handleRecovery,
    dismissRecoveryDialog: () => setShowRecoveryDialog(false)
  };
};
