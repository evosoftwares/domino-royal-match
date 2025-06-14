
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameData, PlayerData } from '@/types/game';
import { toast } from 'sonner';

interface StateCorruptionDetector {
  hasCorruptedState: boolean;
  corruptionType: 'empty_board' | 'invalid_players' | 'missing_data' | 'unknown';
  confidence: number;
}

interface RecoveryOptions {
  forceRefresh: boolean;
  resetCache: boolean;
  fallbackToLastKnown: boolean;
}

export const useGameStateRecovery = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const lastKnownGoodStateRef = useRef<{ game: GameData; players: PlayerData[] } | null>(null);

  const detectStateCorruption = useCallback((gameData: GameData, players: PlayerData[]): StateCorruptionDetector => {
    let corruptionType: StateCorruptionDetector['corruptionType'] = 'unknown';
    let confidence = 0;

    // Detectar board_state vazio ou inválido
    if (!gameData.board_state || !gameData.board_state.pieces || gameData.board_state.pieces.length === 0) {
      if (gameData.status === 'active' && players.some(p => p.hand && p.hand.length < 7)) {
        corruptionType = 'empty_board';
        confidence = 0.9;
      }
    }

    // Detectar jogadores inválidos
    if (players.length === 0 || players.some(p => !p.user_id || !p.hand)) {
      corruptionType = 'invalid_players';
      confidence = 0.8;
    }

    // Detectar dados ausentes críticos
    if (!gameData.id || !gameData.current_player_turn) {
      corruptionType = 'missing_data';
      confidence = 0.95;
    }

    return {
      hasCorruptedState: confidence > 0.7,
      corruptionType,
      confidence
    };
  }, []);

  const saveLastKnownGoodState = useCallback((gameData: GameData, players: PlayerData[]) => {
    const detection = detectStateCorruption(gameData, players);
    
    if (!detection.hasCorruptedState) {
      lastKnownGoodStateRef.current = {
        game: { ...gameData },
        players: [...players]
      };
      console.log('💾 Estado válido salvo como backup');
    }
  }, [detectStateCorruption]);

  const attemptStateRecovery = useCallback(async (
    gameId: string, 
    corruption: StateCorruptionDetector,
    options: RecoveryOptions = { forceRefresh: true, resetCache: true, fallbackToLastKnown: false }
  ): Promise<{ game: GameData | null; players: PlayerData[] }> => {
    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);

    console.group('🔧 Iniciando recuperação de estado');
    console.log('Tipo de corrupção:', corruption.corruptionType);
    console.log('Confiança:', corruption.confidence);
    console.log('Tentativa:', recoveryAttempts + 1);

    try {
      // Estratégia 1: Refresh forçado dos dados
      if (options.forceRefresh) {
        console.log('📡 Tentando refresh forçado...');
        
        const [gameResult, playersResult] = await Promise.all([
          supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single(),
          supabase
            .from('game_players')
            .select('*, profiles(full_name, avatar_url)')
            .eq('game_id', gameId)
            .order('position')
        ]);

        if (!gameResult.error && !playersResult.error && gameResult.data && playersResult.data) {
          const freshDetection = detectStateCorruption(gameResult.data, playersResult.data);
          
          if (!freshDetection.hasCorruptedState) {
            console.log('✅ Estado recuperado via refresh');
            toast.success('Estado do jogo recuperado!');
            console.groupEnd();
            return { game: gameResult.data, players: playersResult.data };
          }
        }
      }

      // Estratégia 2: Fallback para último estado conhecido
      if (options.fallbackToLastKnown && lastKnownGoodStateRef.current) {
        console.log('🔄 Usando último estado conhecido...');
        toast.info('Restaurando último estado válido...');
        console.groupEnd();
        return lastKnownGoodStateRef.current;
      }

      // Estratégia 3: Reconstrução específica por tipo de corrupção
      if (corruption.corruptionType === 'empty_board') {
        console.log('🏗️ Tentando reconstruir board vazio...');
        
        // Tentar forçar uma nova sincronização
        await supabase.rpc('ensure_game_consistency', { p_game_id: gameId });
        
        // Aguardar um pouco e tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const recoveredGame = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (!recoveredGame.error && recoveredGame.data) {
          toast.success('Board do jogo reconstruído!');
          console.groupEnd();
          return { game: recoveredGame.data, players: [] };
        }
      }

      console.log('❌ Todas as estratégias de recuperação falharam');
      toast.error('Não foi possível recuperar o estado do jogo');
      console.groupEnd();
      return { game: null, players: [] };

    } catch (error) {
      console.error('💥 Erro durante recuperação:', error);
      toast.error('Erro durante recuperação de estado');
      console.groupEnd();
      return { game: null, players: [] };
    } finally {
      setIsRecovering(false);
    }
  }, [detectStateCorruption, recoveryAttempts]);

  const resetRecoveryState = useCallback(() => {
    setRecoveryAttempts(0);
    setIsRecovering(false);
    lastKnownGoodStateRef.current = null;
    console.log('🔄 Estado de recuperação resetado');
  }, []);

  return {
    detectStateCorruption,
    saveLastKnownGoodState,
    attemptStateRecovery,
    isRecovering,
    recoveryAttempts,
    resetRecoveryState,
    hasBackup: lastKnownGoodStateRef.current !== null
  };
};
