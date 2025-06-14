
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseOptimizedGameTimerProps {
  isMyTurn: boolean;
  onTimeout: () => void;
  timerDuration?: number;
  isGameActive?: boolean;
}

export const useOptimizedGameTimer = ({ 
  isMyTurn, 
  onTimeout, 
  timerDuration = 15,
  isGameActive = true 
}: UseOptimizedGameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [isWarning, setIsWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Atualizar ref sem causar re-render
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Callback memoizado para timeout
  const handleTimeout = useCallback(() => {
    onTimeoutRef.current();
    setTimeLeft(timerDuration);
    setIsWarning(false);
  }, [timerDuration]);

  // Reset timer quando necessário
  const resetTimer = useCallback(() => {
    setTimeLeft(timerDuration);
    setIsWarning(false);
  }, [timerDuration]);

  useEffect(() => {
    // Limpar timer anterior
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Se não é minha vez ou jogo não está ativo, resetar
    if (!isMyTurn || !isGameActive) {
      resetTimer();
      return;
    }

    // Iniciar novo timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Aviso quando restam 5 segundos
        if (newTime <= 5 && !isWarning) {
          setIsWarning(true);
        }
        
        // Timeout
        if (newTime <= 0) {
          handleTimeout();
          return timerDuration;
        }
        
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isMyTurn, isGameActive, handleTimeout, resetTimer, timerDuration, isWarning]);

  // Reset quando muda a vez
  useEffect(() => {
    resetTimer();
  }, [isMyTurn, resetTimer]);

  return { 
    timeLeft, 
    isWarning,
    resetTimer 
  };
};
