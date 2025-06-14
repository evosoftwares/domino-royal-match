
import { useState, useEffect } from 'react';

interface UseGameTimerProps {
  isMyTurn: boolean;
  onTimeout: () => void;
  timerDuration?: number;
}

export const useGameTimer = ({ isMyTurn, onTimeout, timerDuration = 15 }: UseGameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(timerDuration);

  useEffect(() => {
    if (!isMyTurn) {
      setTimeLeft(timerDuration);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeout();
          return timerDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, onTimeout, timerDuration]);

  // Reset timer quando a vez muda
  useEffect(() => {
    setTimeLeft(timerDuration);
  }, [isMyTurn, timerDuration]);

  return { timeLeft };
};
