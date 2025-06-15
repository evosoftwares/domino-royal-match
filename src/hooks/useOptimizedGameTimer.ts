
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseOptimizedGameTimerProps {
  isMyTurn: boolean;
  onTimeout: () => void;
  timerDuration?: number;
  isGameActive?: boolean;
  onTimeoutWarning?: (timeLeft: number) => void;
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
  const lastMyTurn = useRef(isMyTurn);

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
    console.log('🔄 Resetando timer para', timerDuration, 'segundos');
    setTimeLeft(timerDuration);
    setIsWarning(false);
  }, [timerDuration]);

  // Detectar mudança de turno e resetar timer
  useEffect(() => {
    if (lastMyTurn.current !== isMyTurn) {
      console.log('🔄 Mudança de turno detectada. É minha vez:', isMyTurn);
      lastMyTurn.current = isMyTurn;
      resetTimer();
    }
  }, [isMyTurn, resetTimer]);

  useEffect(() => {
    // Limpar timer anterior
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Se não é minha vez ou jogo não está ativo, não iniciar timer
    if (!isMyTurn || !isGameActive) {
      return;
    }

    console.log('⏱️ Iniciando timer de', timerDuration, 'segundos para o jogador atual');

    // Iniciar novo timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Chamar callback de warning quando necessário
        if (onTimeoutWarningRef.current) {
          onTimeoutWarningRef.current(newTime);
        }
        
        // Aviso quando restam 3 segundos
        if (newTime <= 3 && newTime > 0) {
          setIsWarning(true);
          console.log('⚠️ Aviso: restam apenas', newTime, 'segundos!');
        }
        
        // Timeout
        if (newTime <= 0) {
          console.log('⏰ Timer chegou a zero, executando timeout');
          handleTimeout();
          return 0; // Manter em 0 até reset
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
  }, [isMyTurn, isGameActive, handleTimeout, timerDuration]);

  return { 
    timeLeft, 
    isWarning,
    resetTimer 
  };
};
