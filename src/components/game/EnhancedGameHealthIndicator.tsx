
import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, RotateCcw, AlertTriangle, CheckCircle, 
  Clock, Activity, Database, Zap 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EnhancedGameHealthIndicatorProps {
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  serverHealth: {
    isHealthy: boolean;
    successRate: number;
    serverResponseTime: number;
    timeSinceLastSuccess: number;
    circuitBreakerStatus: 'open' | 'closed';
    pendingFallbacks: number;
  };
  syncStats: {
    pendingOperations: number;
    lastSyncTime: number;
    timeSinceLastSync: number;
    oldestPendingOperation: number | null;
  };
  onForceSync?: () => void;
  onHealthClick?: () => void;
}

const EnhancedGameHealthIndicator: React.FC<EnhancedGameHealthIndicatorProps> = ({
  connectionStatus,
  serverHealth,
  syncStats,
  onForceSync,
  onHealthClick
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'reconnecting':
        return <RotateCcw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-400" />;
    }
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'border-green-600/50 bg-green-900/20';
      case 'reconnecting':
        return 'border-yellow-600/50 bg-yellow-900/20';
      case 'disconnected':
        return 'border-red-600/50 bg-red-900/20';
    }
  };

  const getHealthIcon = () => {
    if (serverHealth.circuitBreakerStatus === 'open') {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    
    if (serverHealth.isHealthy) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    
    return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  };

  const getHealthColor = () => {
    if (serverHealth.circuitBreakerStatus === 'open') {
      return 'border-red-600/50 bg-red-900/20';
    }
    if (serverHealth.isHealthy) {
      return 'border-green-600/50 bg-green-900/20';
    }
    return 'border-yellow-600/50 bg-yellow-900/20';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = currentTime - timestamp;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s atrás`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
    return `${Math.floor(diff / 3600000)}h atrás`;
  };

  const getOverallHealthStatus = () => {
    if (connectionStatus === 'disconnected' || serverHealth.circuitBreakerStatus === 'open') {
      return { status: 'critical', color: 'red', text: 'Sistema Crítico' };
    }
    
    if (connectionStatus === 'reconnecting' || !serverHealth.isHealthy) {
      return { status: 'warning', color: 'yellow', text: 'Sistema Degradado' };
    }
    
    if (syncStats.pendingOperations > 0) {
      return { status: 'sync', color: 'blue', text: 'Sincronizando' };
    }
    
    return { status: 'healthy', color: 'green', text: 'Sistema OK' };
  };

  const overallHealth = getOverallHealthStatus();

  return (
    <div className="fixed top-16 right-4 z-40 space-y-2">
      {/* Status Geral */}
      <div 
        className={`bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 border shadow-lg cursor-pointer transition-all 
          border-${overallHealth.color}-600/50 bg-${overallHealth.color}-900/20`}
        onClick={() => {
          setShowDetails(!showDetails);
          onHealthClick?.();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 text-${overallHealth.color}-400`} />
            <span className="text-sm font-medium text-slate-200">
              {overallHealth.text}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {syncStats.pendingOperations > 0 && (
              <Badge variant="outline" className="text-xs">
                {syncStats.pendingOperations}
              </Badge>
            )}
            {getConnectionIcon()}
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-3">
            {/* Conectividade */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Wifi className="w-3 h-3" />
                <span className="font-medium">Conectividade</span>
              </div>
              <div className="ml-5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`text-${overallHealth.color}-400`}>
                    {connectionStatus === 'connected' ? 'Conectado' :
                     connectionStatus === 'reconnecting' ? 'Reconectando' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resposta:</span>
                  <span>{formatTime(serverHealth.serverResponseTime)}</span>
                </div>
              </div>
            </div>

            {/* Sincronização */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Database className="w-3 h-3" />
                <span className="font-medium">Sincronização</span>
              </div>
              <div className="ml-5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Pendentes:</span>
                  <span className={syncStats.pendingOperations > 0 ? 'text-orange-400' : 'text-green-400'}>
                    {syncStats.pendingOperations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Último Sync:</span>
                  <span>{formatTimestamp(syncStats.lastSyncTime)}</span>
                </div>
                {syncStats.oldestPendingOperation && (
                  <div className="flex justify-between">
                    <span>Mais Antiga:</span>
                    <span className="text-orange-400">
                      {formatTimestamp(syncStats.oldestPendingOperation)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sistema */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Zap className="w-3 h-3" />
                <span className="font-medium">Sistema</span>
              </div>
              <div className="ml-5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Taxa Sucesso:</span>
                  <span className={serverHealth.successRate > 95 ? 'text-green-400' : 
                                  serverHealth.successRate > 80 ? 'text-yellow-400' : 'text-red-400'}>
                    {serverHealth.successRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Circuit Breaker:</span>
                  <span className={serverHealth.circuitBreakerStatus === 'closed' ? 'text-green-400' : 'text-red-400'}>
                    {serverHealth.circuitBreakerStatus === 'closed' ? 'Fechado' : 'Aberto'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações */}
            {(syncStats.pendingOperations > 0 || !serverHealth.isHealthy) && (
              <div className="pt-2 border-t border-slate-700/50">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onForceSync?.();
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Forçar Sincronização
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alertas Específicos */}
      {serverHealth.circuitBreakerStatus === 'open' && (
        <div className="bg-red-900/90 backdrop-blur-sm rounded-lg p-2 border border-red-600/50 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-200">
              Servidor temporariamente indisponível
            </span>
          </div>
        </div>
      )}

      {syncStats.pendingOperations > 5 && (
        <div className="bg-orange-900/90 backdrop-blur-sm rounded-lg p-2 border border-orange-600/50 shadow-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-200">
              Muitas operações pendentes ({syncStats.pendingOperations})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedGameHealthIndicator;
