
import { useState, useCallback, useRef } from 'react';

interface CommunicationHealth {
  serverResponseTime: number;
  successRate: number;
  lastSuccessfulCall: number;
  totalCalls: number;
  failedCalls: number;
}

export const useHealthMonitoring = () => {
  const [healthMetrics, setHealthMetrics] = useState<CommunicationHealth>({
    serverResponseTime: 0,
    successRate: 100,
    lastSuccessfulCall: Date.now(),
    totalCalls: 0,
    failedCalls: 0
  });

  const responseTimesRef = useRef<number[]>([]);

  const updateHealthMetrics = useCallback((success: boolean, responseTime: number) => {
    setHealthMetrics(prev => {
      const newTotalCalls = prev.totalCalls + 1;
      const newFailedCalls = success ? prev.failedCalls : prev.failedCalls + 1;
      
      // Manter apenas os últimos 20 tempos de resposta
      responseTimesRef.current.push(responseTime);
      if (responseTimesRef.current.length > 20) {
        responseTimesRef.current = responseTimesRef.current.slice(-20);
      }

      const avgResponseTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;

      return {
        serverResponseTime: avgResponseTime,
        successRate: ((newTotalCalls - newFailedCalls) / newTotalCalls) * 100,
        lastSuccessfulCall: success ? Date.now() : prev.lastSuccessfulCall,
        totalCalls: newTotalCalls,
        failedCalls: newFailedCalls
      };
    });
  }, []);

  const getSystemHealth = useCallback(() => {
    const timeSinceLastSuccess = Date.now() - healthMetrics.lastSuccessfulCall;
    const isHealthy = healthMetrics.successRate > 80 && timeSinceLastSuccess < 60000;

    return {
      ...healthMetrics,
      isHealthy,
      timeSinceLastSuccess
    };
  }, [healthMetrics]);

  return {
    healthMetrics,
    updateHealthMetrics,
    getSystemHealth
  };
};
