import { useCallback, useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';

interface HealthMetrics {
  memoryUsage: number;
  cpuTime: number;
  networkLatency: number;
  errorRate: number;
  uptime: number;
  lastHealthCheck: number;
}

interface SystemAlerts {
  highMemoryUsage: boolean;
  highErrorRate: boolean;
  networkIssues: boolean;
  performanceDegradation: boolean;
}

interface HealthThresholds {
  memoryWarning: number;
  memoryCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  latencyWarning: number;
  latencyCritical: number;
}

export const useSystemHealthMonitor = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>({
    memoryUsage: 0,
    cpuTime: 0,
    networkLatency: 0,
    errorRate: 0,
    uptime: Date.now(),
    lastHealthCheck: Date.now()
  });

  const [alerts, setAlerts] = useState<SystemAlerts>({
    highMemoryUsage: false,
    highErrorRate: false,
    networkIssues: false,
    performanceDegradation: false
  });

  const errorCount = useRef(0);
  const successCount = useRef(0);
  const latencyHistory = useRef<number[]>([]);
  const healthCheckInterval = useRef<NodeJS.Timeout>();

  // Default thresholds
  const thresholds: HealthThresholds = {
    memoryWarning: 50, // MB
    memoryCritical: 100, // MB
    errorRateWarning: 5, // %
    errorRateCritical: 15, // %
    latencyWarning: 1000, // ms
    latencyCritical: 3000 // ms
  };

  // Collect performance metrics
  const collectMetrics = useCallback(() => {
    const now = Date.now();
    
    // Memory usage estimation (simplified)
    const memoryUsage = (performance as any).memory?.usedJSHeapSize 
      ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 
      : 0;

    // CPU time (simplified)
    const cpuTime = performance.now();

    // Calculate error rate
    const totalRequests = errorCount.current + successCount.current;
    const errorRate = totalRequests > 0 ? (errorCount.current / totalRequests) * 100 : 0;

    // Calculate average latency
    const avgLatency = latencyHistory.current.length > 0
      ? latencyHistory.current.reduce((sum, lat) => sum + lat, 0) / latencyHistory.current.length
      : 0;

    const newMetrics: HealthMetrics = {
      memoryUsage,
      cpuTime,
      networkLatency: avgLatency,
      errorRate,
      uptime: now - healthMetrics.uptime,
      lastHealthCheck: now
    };

    setHealthMetrics(newMetrics);
    return newMetrics;
  }, [healthMetrics.uptime]);

  // Check health thresholds and generate alerts
  const checkHealthThresholds = useCallback((metrics: HealthMetrics) => {
    const newAlerts: SystemAlerts = {
      highMemoryUsage: metrics.memoryUsage > thresholds.memoryCritical,
      highErrorRate: metrics.errorRate > thresholds.errorRateCritical,
      networkIssues: metrics.networkLatency > thresholds.latencyCritical,
      performanceDegradation: metrics.networkLatency > thresholds.latencyWarning && metrics.errorRate > thresholds.errorRateWarning
    };

    // Check if alerts changed
    const alertsChanged = Object.keys(newAlerts).some(key => 
      newAlerts[key as keyof SystemAlerts] !== alerts[key as keyof SystemAlerts]
    );

    if (alertsChanged) {
      setAlerts(newAlerts);

      // Send notifications for new critical alerts
      if (newAlerts.highMemoryUsage && !alerts.highMemoryUsage) {
        toast.error(`Uso crítico de memória: ${metrics.memoryUsage.toFixed(1)}MB`);
      }
      if (newAlerts.highErrorRate && !alerts.highErrorRate) {
        toast.error(`Taxa de erro crítica: ${metrics.errorRate.toFixed(1)}%`);
      }
      if (newAlerts.networkIssues && !alerts.networkIssues) {
        toast.error(`Problemas de rede críticos: ${metrics.networkLatency.toFixed(0)}ms`);
      }
    }
  }, [alerts, thresholds]);

  // Record successful operation
  const recordSuccess = useCallback((responseTime?: number) => {
    successCount.current++;
    
    if (responseTime) {
      latencyHistory.current.push(responseTime);
      
      // Keep only last 50 measurements
      if (latencyHistory.current.length > 50) {
        latencyHistory.current = latencyHistory.current.slice(-50);
      }
    }
  }, []);

  // Record failed operation
  const recordError = useCallback((responseTime?: number, error?: any) => {
    errorCount.current++;
    
    if (responseTime) {
      latencyHistory.current.push(responseTime);
      
      if (latencyHistory.current.length > 50) {
        latencyHistory.current = latencyHistory.current.slice(-50);
      }
    }

    console.error('🚨 Erro registrado no health monitor:', error);
  }, []);

  // Get system health status
  const getHealthStatus = useCallback(() => {
    const metrics = collectMetrics();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (metrics.memoryUsage > thresholds.memoryCritical || 
        metrics.errorRate > thresholds.errorRateCritical || 
        metrics.networkLatency > thresholds.latencyCritical) {
      status = 'critical';
    } else if (metrics.memoryUsage > thresholds.memoryWarning || 
               metrics.errorRate > thresholds.errorRateWarning || 
               metrics.networkLatency > thresholds.latencyWarning) {
      status = 'warning';
    }

    return {
      status,
      metrics,
      alerts,
      recommendations: getHealthRecommendations(metrics, alerts)
    };
  }, [collectMetrics, alerts, thresholds]);

  // Get health recommendations
  const getHealthRecommendations = useCallback((metrics: HealthMetrics, currentAlerts: SystemAlerts) => {
    const recommendations: string[] = [];

    if (currentAlerts.highMemoryUsage) {
      recommendations.push('Considere limpar caches ou reduzir dados em memória');
    }
    if (currentAlerts.highErrorRate) {
      recommendations.push('Verifique conectividade de rede e status do servidor');
    }
    if (currentAlerts.networkIssues) {
      recommendations.push('Problemas de latência detectados - considere modo offline');
    }
    if (currentAlerts.performanceDegradation) {
      recommendations.push('Performance degradada - ative otimizações de fallback');
    }

    if (recommendations.length === 0) {
      recommendations.push('Sistema funcionando normalmente');
    }

    return recommendations;
  }, []);

  // Start continuous health monitoring
  const startHealthMonitoring = useCallback((interval: number = 30000) => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
    }

    healthCheckInterval.current = setInterval(() => {
      const metrics = collectMetrics();
      checkHealthThresholds(metrics);
    }, interval);

    console.log('🔍 Health monitoring iniciado');
  }, [collectMetrics, checkHealthThresholds]);

  // Stop health monitoring
  const stopHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
      healthCheckInterval.current = undefined;
    }
    console.log('🛑 Health monitoring parado');
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    errorCount.current = 0;
    successCount.current = 0;
    latencyHistory.current = [];
    
    setHealthMetrics({
      memoryUsage: 0,
      cpuTime: 0,
      networkLatency: 0,
      errorRate: 0,
      uptime: Date.now(),
      lastHealthCheck: Date.now()
    });

    setAlerts({
      highMemoryUsage: false,
      highErrorRate: false,
      networkIssues: false,
      performanceDegradation: false
    });

    console.log('📊 Métricas de health resetadas');
  }, []);

  // Auto-start monitoring
  useEffect(() => {
    startHealthMonitoring();
    return () => stopHealthMonitoring();
  }, [startHealthMonitoring, stopHealthMonitoring]);

  return {
    // Metrics
    healthMetrics,
    alerts,
    
    // Recording methods
    recordSuccess,
    recordError,
    
    // Health status
    getHealthStatus,
    
    // Control
    startHealthMonitoring,
    stopHealthMonitoring,
    resetMetrics,
    
    // Utils
    collectMetrics
  };
};
