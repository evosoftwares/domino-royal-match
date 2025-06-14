
import { useState, useCallback, useEffect, useRef } from 'react';

interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  metadata?: any;
}

interface SyncMetrics {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageLatency: number;
  conflictCount: number;
  rollbackCount: number;
}

interface LocalFirstMetrics {
  performance: PerformanceMetric[];
  sync: SyncMetrics;
  lastUpdated: number;
}

export const useLocalFirstMetrics = () => {
  const [metrics, setMetrics] = useState<LocalFirstMetrics>({
    performance: [],
    sync: {
      totalOperations: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageLatency: 0,
      conflictCount: 0,
      rollbackCount: 0
    },
    lastUpdated: Date.now()
  });

  const activeOperationsRef = useRef<Map<string, PerformanceMetric>>(new Map());
  const latencyHistoryRef = useRef<number[]>([]);

  // Iniciar medição de operação
  const startOperation = useCallback((operation: string, metadata?: any): string => {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const metric: PerformanceMetric = {
      operation,
      startTime: performance.now(),
      success: false,
      metadata
    };

    activeOperationsRef.current.set(operationId, metric);
    console.log(`📊 Iniciando medição: ${operation}`);
    
    return operationId;
  }, []);

  // Finalizar medição de operação
  const endOperation = useCallback((operationId: string, success: boolean, error?: string) => {
    const metric = activeOperationsRef.current.get(operationId);
    if (!metric) {
      console.warn('⚠️ Operação não encontrada para finalizar:', operationId);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      success,
      error
    };

    // Remover da lista ativa
    activeOperationsRef.current.delete(operationId);

    // Atualizar métricas
    setMetrics(prev => {
      const newPerformance = [...prev.performance, completedMetric].slice(-100); // Manter últimas 100
      
      // Atualizar métricas de sync se for operação de sync
      let newSync = { ...prev.sync };
      if (metric.operation.includes('sync') || metric.operation.includes('play_move') || metric.operation.includes('pass_turn')) {
        newSync.totalOperations++;
        
        if (success) {
          newSync.successfulSyncs++;
          latencyHistoryRef.current.push(duration);
          
          // Manter últimas 50 latências para média
          if (latencyHistoryRef.current.length > 50) {
            latencyHistoryRef.current = latencyHistoryRef.current.slice(-50);
          }
          
          newSync.averageLatency = latencyHistoryRef.current.reduce((a, b) => a + b, 0) / latencyHistoryRef.current.length;
        } else {
          newSync.failedSyncs++;
        }
      }

      console.log(`📊 Operação finalizada: ${metric.operation} (${duration.toFixed(2)}ms) - ${success ? '✅' : '❌'}`);

      return {
        performance: newPerformance,
        sync: newSync,
        lastUpdated: Date.now()
      };
    });
  }, []);

  // Registrar conflito
  const recordConflict = useCallback((conflictType: string, resolution: string) => {
    setMetrics(prev => ({
      ...prev,
      sync: {
        ...prev.sync,
        conflictCount: prev.sync.conflictCount + 1
      },
      lastUpdated: Date.now()
    }));

    console.log(`⚡ Conflito registrado: ${conflictType} -> ${resolution}`);
  }, []);

  // Registrar rollback
  const recordRollback = useCallback((reason: string) => {
    setMetrics(prev => ({
      ...prev,
      sync: {
        ...prev.sync,
        rollbackCount: prev.sync.rollbackCount + 1
      },
      lastUpdated: Date.now()
    }));

    console.log(`⏪ Rollback registrado: ${reason}`);
  }, []);

  // Obter estatísticas detalhadas
  const getDetailedStats = useCallback(() => {
    const now = Date.now();
    const recentMetrics = metrics.performance.filter(m => m.endTime && (now - m.endTime) < 300000); // Últimos 5 minutos
    
    const operationStats = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = {
          total: 0,
          successful: 0,
          failed: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }
      
      acc[metric.operation].total++;
      if (metric.success) {
        acc[metric.operation].successful++;
      } else {
        acc[metric.operation].failed++;
      }
      
      if (metric.endTime) {
        const duration = metric.endTime - metric.startTime;
        acc[metric.operation].totalDuration += duration;
        acc[metric.operation].avgDuration = acc[metric.operation].totalDuration / acc[metric.operation].total;
      }
      
      return acc;
    }, {} as Record<string, any>);

    const syncEfficiency = metrics.sync.totalOperations > 0 
      ? (metrics.sync.successfulSyncs / metrics.sync.totalOperations) * 100 
      : 100;

    return {
      operations: operationStats,
      sync: {
        ...metrics.sync,
        efficiency: syncEfficiency,
        latencyHistory: latencyHistoryRef.current.slice(-10)
      },
      health: {
        isHealthy: syncEfficiency > 80 && metrics.sync.conflictCount < 10,
        activeOperations: activeOperationsRef.current.size,
        recentOperations: recentMetrics.length
      }
    };
  }, [metrics]);

  // Limpar métricas antigas
  const cleanup = useCallback(() => {
    const now = Date.now();
    const maxAge = 600000; // 10 minutos
    
    setMetrics(prev => ({
      ...prev,
      performance: prev.performance.filter(m => 
        m.endTime && (now - m.endTime) < maxAge
      ),
      lastUpdated: now
    }));

    // Limpar operações ativas muito antigas
    activeOperationsRef.current.forEach((metric, id) => {
      if (now - metric.startTime > 60000) { // 1 minuto
        console.warn('⚠️ Removendo operação ativa antiga:', metric.operation);
        activeOperationsRef.current.delete(id);
      }
    });
  }, []);

  // Exportar métricas (para debug/análise)
  const exportMetrics = useCallback(() => {
    const data = {
      metrics,
      detailedStats: getDetailedStats(),
      activeOperations: Array.from(activeOperationsRef.current.entries()),
      timestamp: Date.now()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('📊 Métricas exportadas');
  }, [metrics, getDetailedStats]);

  // Reset métricas
  const resetMetrics = useCallback(() => {
    setMetrics({
      performance: [],
      sync: {
        totalOperations: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageLatency: 0,
        conflictCount: 0,
        rollbackCount: 0
      },
      lastUpdated: Date.now()
    });
    
    activeOperationsRef.current.clear();
    latencyHistoryRef.current = [];
    
    console.log('🧹 Métricas resetadas');
  }, []);

  // Cleanup automático
  useEffect(() => {
    const interval = setInterval(cleanup, 60000); // A cada minuto
    return () => clearInterval(interval);
  }, [cleanup]);

  return {
    // Medição
    startOperation,
    endOperation,
    recordConflict,
    recordRollback,
    
    // Dados
    metrics,
    getDetailedStats,
    
    // Utilidades
    exportMetrics,
    resetMetrics,
    cleanup
  };
};
