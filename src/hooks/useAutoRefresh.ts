
import { useEffect, useRef } from 'react';

interface UseAutoRefreshProps {
  intervalMs?: number;
  isActive?: boolean;
  onRefresh?: () => void;
}

export const useAutoRefresh = ({
  intervalMs = 10000, // 10 segundos por padrão
  isActive = true,
  onRefresh
}: UseAutoRefreshProps = {}) => {
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    console.log(`🔄 Auto-refresh ativado a cada ${intervalMs / 1000} segundos`);

    intervalRef.current = setInterval(() => {
      console.log('🔄 Executando auto-refresh da página');
      
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMs, isActive, onRefresh]);

  const manualRefresh = () => {
    console.log('🔄 Refresh manual executado');
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return { manualRefresh };
};
