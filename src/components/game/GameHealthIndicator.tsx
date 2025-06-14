
import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RotateCcw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface GameHealthIndicatorProps {
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  serverHealth: {
    isHealthy: boolean;
    successRate: number;
    serverResponseTime: number;
    timeSinceLastSuccess: number;
    circuitBreakerStatus: 'open' | 'closed';
    pendingFallbacks: number;
  };
  pendingMovesCount: number;
  onHealthClick?: () => void;
}

const GameHealthIndicator: React.FC<GameHealthIndicatorProps> = ({
  connectionStatus,
  serverHealth,
  pendingMovesCount,
  onHealthClick
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
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
    if (serverHealth.circuitBreakerStatus === 'open') return 'border-red-600/50 bg-red-900/20';
    if (serverHealth.isHealthy) return 'border-green-600/50 bg-green-900/20';
    return 'border-yellow-600/50 bg-yellow-900/20';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m`;
  };

  return (
    <div className="fixed top-16 right-4 z-40 space-y-2">
      {/* Connection Status */}
      <div className={`bg-slate-900/90 backdrop-blur-sm rounded-lg p-2 border shadow-lg ${
        connectionStatus === 'connected' ? 'border-green-600/50' :
        connectionStatus === 'reconnecting' ? 'border-yellow-600/50' :
        'border-red-600/50'
      }`}>
        <div className="flex items-center gap-2">
          {getConnectionIcon()}
          <span className="text-xs text-slate-200">
            {connectionStatus === 'connected' ? 'Conectado' :
             connectionStatus === 'reconnecting' ? 'Reconectando...' :
             'Desconectado'}
          </span>
        </div>
      </div>

      {/* Server Health */}
      <div 
        className={`bg-slate-900/90 backdrop-blur-sm rounded-lg p-2 border shadow-lg cursor-pointer transition-all ${getHealthColor()}`}
        onClick={() => {
          setShowDetails(!showDetails);
          onHealthClick?.();
        }}
      >
        <div className="flex items-center gap-2">
          {getHealthIcon()}
          <span className="text-xs text-slate-200">
            {serverHealth.circuitBreakerStatus === 'open' ? 'Servidor Offline' :
             serverHealth.isHealthy ? 'Sistema OK' : 'Sistema Degradado'}
          </span>
        </div>

        {showDetails && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
            <div className="text-xs text-slate-300 flex justify-between">
              <span>Taxa de Sucesso:</span>
              <span>{serverHealth.successRate.toFixed(1)}%</span>
            </div>
            <div className="text-xs text-slate-300 flex justify-between">
              <span>Tempo Resposta:</span>
              <span>{formatTime(serverHealth.serverResponseTime)}</span>
            </div>
            <div className="text-xs text-slate-300 flex justify-between">
              <span>Último Sucesso:</span>
              <span>{formatTime(serverHealth.timeSinceLastSuccess)} atrás</span>
            </div>
            {serverHealth.pendingFallbacks > 0 && (
              <div className="text-xs text-orange-300 flex justify-between">
                <span>Pendente:</span>
                <span>{serverHealth.pendingFallbacks} ações</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Moves */}
      {pendingMovesCount > 0 && (
        <div className="bg-blue-900/90 backdrop-blur-sm rounded-lg p-2 border border-blue-600/50 shadow-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-200">
              {pendingMovesCount} ação(ões) pendente(s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameHealthIndicator;
