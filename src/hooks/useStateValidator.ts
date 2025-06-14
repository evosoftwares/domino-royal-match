import { useCallback, useRef, useEffect } from 'react';
import { GameData, PlayerData } from '@/types/game';
import { useGameDataValidator } from '@/hooks/useGameDataValidator';

interface StateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  corrupted: boolean;
  confidence: number;
}

interface UseStateValidatorProps {
  gameState: GameData;
  playersState: PlayerData[];
  onCorruption: (result: StateValidationResult) => void;
  onValidationFailed: (errors: string[]) => void;
  validationInterval?: number;
}

export const useStateValidator = ({
  gameState,
  playersState,
  onCorruption,
  onValidationFailed,
  validationInterval = 10000 // 10 segundos
}: UseStateValidatorProps) => {
  const lastValidationRef = useRef<number>(0);
  const validationCountRef = useRef<number>(0);
  const errorHistoryRef = useRef<string[]>([]);
  const corruptionThresholdRef = useRef<number>(3);

  // Usar o hook para obter a função de validação
  const { validateGameData } = useGameDataValidator();

  // Validação principal
  const validateCurrentState = useCallback((): StateValidationResult => {
    try {
      validationCountRef.current++;
      
      const basicValidation = validateGameData(gameState, playersState);
      let corrupted = false;
      let confidence = 100;

      // Verificações específicas de corrupção
      const corruptionChecks = [
        // Verificar se o jogador atual existe
        () => {
          if (gameState.current_player_turn) {
            const currentPlayer = playersState.find(p => p.user_id === gameState.current_player_turn);
            if (!currentPlayer) {
              return 'Jogador atual não existe na lista de jogadores';
            }
          }
          return null;
        },

        // Verificar contagem de peças
        () => {
          const totalPieces = playersState.reduce((sum, player) => {
            return sum + (player.hand ? player.hand.length : 0);
          }, 0);
          
          const boardPieces = gameState.board_state?.pieces?.length || 0;
          const total = totalPieces + boardPieces;
          
          if (total > 28) {
            return `Muitas peças no jogo: ${total} (máximo: 28)`;
          }
          if (total < 10 && playersState.length > 1) {
            return `Poucas peças no jogo: ${total} (suspeito)`;
          }
          return null;
        },

        // Verificar integridade do tabuleiro
        () => {
          if (gameState.board_state?.pieces) {
            for (let i = 0; i < gameState.board_state.pieces.length; i++) {
              const piece = gameState.board_state.pieces[i];
              if (!piece || !piece.piece) {
                return `Peça inválida no tabuleiro na posição ${i}`;
              }
            }
          }
          return null;
        },

        // Verificar status do jogo
        () => {
          if (!['waiting', 'active', 'finished'].includes(gameState.status)) {
            return `Status de jogo inválido: ${gameState.status}`;
          }
          return null;
        }
      ];

      const corruptionErrors: string[] = [];
      
      for (const check of corruptionChecks) {
        const error = check();
        if (error) {
          corruptionErrors.push(error);
          corrupted = true;
          confidence -= 20;
        }
      }

      // Verificar histórico de erros
      if (basicValidation.errors.length > 0) {
        errorHistoryRef.current.push(...basicValidation.errors);
        // Manter apenas os últimos 20 erros
        if (errorHistoryRef.current.length > 20) {
          errorHistoryRef.current = errorHistoryRef.current.slice(-20);
        }

        // Se muitos erros recentes, reduzir confiança
        const recentErrors = errorHistoryRef.current.slice(-5);
        const uniqueRecentErrors = new Set(recentErrors).size;
        if (uniqueRecentErrors < 2 && recentErrors.length >= 3) {
          // Mesmo erro repetindo
          confidence -= 30;
          corrupted = true;
        }
      }

      const result: StateValidationResult = {
        isValid: basicValidation.isValid && !corrupted,
        errors: [...basicValidation.errors, ...corruptionErrors],
        warnings: basicValidation.warnings,
        corrupted,
        confidence: Math.max(0, confidence)
      };

      // Log detalhado se validação falhou
      if (!result.isValid || corrupted) {
        console.group('🚨 Validação de Estado Falhou');
        console.log('Estado do jogo:', gameState);
        console.log('Estado dos jogadores:', playersState);
        console.log('Erros:', result.errors);
        console.log('Avisos:', result.warnings);
        console.log('Corrompido:', corrupted);
        console.log('Confiança:', confidence);
        console.groupEnd();
      }

      return result;
    } catch (error) {
      console.error('❌ Erro durante validação de estado:', error);
      return {
        isValid: false,
        errors: [`Erro de validação: ${error.message}`],
        warnings: [],
        corrupted: true,
        confidence: 0
      };
    }
  }, [gameState, playersState, validateGameData]);

  // Validação automática periódica
  const runPeriodicValidation = useCallback(() => {
    const now = Date.now();
    if (now - lastValidationRef.current < validationInterval) {
      return;
    }

    lastValidationRef.current = now;
    const result = validateCurrentState();

    if (!result.isValid) {
      console.warn('⚠️ Validação periódica falhou:', result.errors);
      onValidationFailed(result.errors);
    }

    if (result.corrupted || result.confidence < 50) {
      console.error('💥 Estado corrompido detectado:', result);
      onCorruption(result);
    }

    // Log estatísticas periodicamente
    if (validationCountRef.current % 10 === 0) {
      console.log('📊 Estatísticas de validação:', {
        totalValidations: validationCountRef.current,
        recentErrors: errorHistoryRef.current.slice(-5),
        corruptionThreshold: corruptionThresholdRef.current
      });
    }
  }, [validationInterval, validateCurrentState, onValidationFailed, onCorruption]);

  // Validação manual (para uso em componentes)
  const validateNow = useCallback(() => {
    return validateCurrentState();
  }, [validateCurrentState]);

  // Limpar histórico de erros
  const clearErrorHistory = useCallback(() => {
    errorHistoryRef.current = [];
    console.log('🧹 Histórico de erros limpo');
  }, []);

  // Ajustar threshold de corrupção
  const setCorruptionThreshold = useCallback((threshold: number) => {
    corruptionThresholdRef.current = Math.max(1, Math.min(10, threshold));
  }, []);

  // Estatísticas
  const getValidationStats = useCallback(() => {
    return {
      totalValidations: validationCountRef.current,
      recentErrors: errorHistoryRef.current.slice(-10),
      errorCount: errorHistoryRef.current.length,
      lastValidation: lastValidationRef.current,
      corruptionThreshold: corruptionThresholdRef.current
    };
  }, []);

  // Efeito para validação automática
  useEffect(() => {
    const interval = setInterval(runPeriodicValidation, validationInterval);
    return () => clearInterval(interval);
  }, [runPeriodicValidation, validationInterval]);

  // Validação imediata quando estado muda
  useEffect(() => {
    const timer = setTimeout(() => {
      runPeriodicValidation();
    }, 1000); // Delay para evitar validações muito frequentes

    return () => clearTimeout(timer);
  }, [gameState, playersState, runPeriodicValidation]);

  return {
    validateNow,
    clearErrorHistory,
    setCorruptionThreshold,
    getValidationStats,
    
    // Status
    validationCount: validationCountRef.current,
    lastValidation: lastValidationRef.current
  };
};
