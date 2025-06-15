
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseOptimizedGameTimerProps {
  isMyTurn: boolean;
  onTimeout: () => void;
  timerDuration?: number;
  isGameActive?: boolean;
  onTimeoutWarning?: (timeLeft: number) => void; // Novo callback para avisos
}

export const useOptimizedGameTimer = ({ 
  isMyTurn, 
  onTimeout, 
  timerDuration = 10,
  isGameActive = true,
  onTimeoutWarning
}: UseOptimizedGameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [isWarning, setIsWarning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const onTimeoutWarningRef = useRef(onTimeoutWarning);

  // Atualizar refs sem causar re-render
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onTimeoutWarningRef.current = onTimeoutWarning;
  }, [onTimeoutWarning]);

  // Callback memoizado para timeout
  const handleTimeout = useCallback(() => {
    console.log('⏰ Timer expirado - executando callback de timeout');
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

    console.log('⏱️ Iniciando timer de 10 segundos para jogada');

    // Iniciar novo timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Chamar callback de warning quando necessário
        if (onTimeoutWarningRef.current) {
          onTimeoutWarningRef.current(newTime);
        }
        
        // Aviso quando restam 3 segundos
        if (newTime <= 3 && !isWarning) {
          setIsWarning(true);
          console.log('⚠️ Aviso: restam apenas 3 segundos!');
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
