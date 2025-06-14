import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameEngine } from '@/hooks/useGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { useStateValidator } from '@/hooks/useStateValidator';
import { useSmartReconciliation } from '@/hooks/useSmartReconciliation';
import { useSystemHealthMonitor } from '@/hooks/useSystemHealthMonitor';
import { useIntegrationTesting } from '@/hooks/useIntegrationTesting';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import ConflictResolutionDialog from './game/ConflictResolutionDialog';
import SystemHealthDashboard from './game/SystemHealthDashboard';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import { useGameDataProcessing } from '@/hooks/useGameDataProcessing';
import { useGameHandlers } from '@/hooks/useGameHandlers';
import GameLoadingScreen from './game/GameLoadingScreen';
import GameMobileLayout from './game/GameMobileLayout';
import GameDesktopLayout from './game/GameDesktopLayout';
import GameHealthIndicator from './game/GameHealthIndicator';
import { useGameDebug } from '@/hooks/useGameDebug';
import { toast } from 'sonner';

interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}

type ActionType = 'playing' | 'passing' | 'auto_playing';

const Game2Room: React.FC<Game2RoomProps> = ({
  gameData: initialGameData,
  players: initialPlayers,
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Engine de jogo unificado
  const {
    gameState,
    playersState,
    playPiece,
    passTurn,
    playAutomatic,
    isMyTurn,
    isProcessingMove,
    currentAction,
    syncStatus,
    pendingMovesCount,
    getStateHealth,
    forceSync,
    debugInfo
  } = useGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

  // Sistema de monitoramento de saúde integrado
  const {
    healthMetrics,
    alerts,
    recordSuccess,
    recordError,
    getHealthStatus,
    resetMetrics
  } = useSystemHealthMonitor();

  // Sistema de testes de integração completo
  const {
    runIntegrationTests,
    isRunningTests,
    testResults,
    getTestSummary
  } = useIntegrationTesting();

  // Sistema de reconciliação inteligente com detecção de conflitos
  const {
    reconcileStates,
    resolveCriticalConflict,
    forceReconciliation,
    reconciliationStatus,
    criticalConflicts,
    getReconciliationStats
  } = useSmartReconciliation({
    onStateReconciled: (reconciledGameState, reconciledPlayersState) => {
      console.log('🔄 Estados reconciliados aplicados automaticamente');
      // O useGameEngine já gerencia a atualização de estado
      recordSuccess(50); // Registrar sucesso na reconciliação
    },
    onCriticalConflict: (conflicts) => {
      console.error('🚨 Conflitos críticos detectados:', conflicts);
      recordError(100, new Error(`Critical conflicts: ${conflicts.length}`));
      toast.error(`${conflicts.length} conflito${conflicts.length > 1 ? 's' : ''} crítico${conflicts.length > 1 ? 's' : ''} detectado${conflicts.length > 1 ? 's' : ''}`);
    }
  });

  // Validação contínua de estado com integração completa
  useStateValidator({
    gameState,
    playersState,
    onCorruption: (result) => {
      console.error('💥 Corrupção detectada:', result);
      recordError(200, new Error(`State corruption: ${result.confidence}% confidence`));
      toast.error(`Estado corrompido detectado (${result.confidence}% confiança)`);
      
      // Se muito corrompido, forçar sync
      if (result.confidence < 30) {
        console.log('🔧 Forçando sincronização devido à corrupção');
        forceSync();
      }
    },
    onValidationFailed: (errors) => {
      console.warn('⚠️ Validação falhou:', errors);
      if (errors.length > 3) {
        recordError(50, new Error(`Validation failed: ${errors.length} errors`));
        toast.warning('Problemas de sincronização detectados');
      }
    },
    validationInterval: 15000 // 15 segundos
  });

  // Processamento de dados do jogo
  const {
    processedPlayers,
    currentUserPlayer,
    opponents,
    placedPieces
  } = useGameDataProcessing({
    gameState,
    playersState,
    userId: user?.id
  });

  // Handlers do jogo com integração local-first
  const gameHandlers = useGameHandlers({
    gameState,
    currentUserPlayer,
    isMyTurn,
    isProcessingMove,
    playPiece,
    passTurn
  });

  // Timer otimizado
  const { timeLeft, isWarning } = useOptimizedGameTimer({
    isMyTurn: isMyTurn,
    onTimeout: () => {
      if (!isProcessingMove) {
        gameHandlers.handleAutoPlay();
      }
    },
    isGameActive: gameState.status === 'active',
  });

  // Verificação de vitória
  const winState = useGameWinCheck({
    players: processedPlayers,
    gameStatus: gameState.status
  });

  // Health do sistema - integrado com todos os monitores
  const systemHealth = React.useMemo(() => {
    const stateHealth = getStateHealth();
    const healthStatus = getHealthStatus();
    const reconciliationStats = getReconciliationStats();
    
    return {
      isHealthy: healthStatus.status === 'healthy' && stateHealth.isHealthy,
      successRate: (healthMetrics.errorRate > 0 ? (100 - healthMetrics.errorRate) : 100),
      serverResponseTime: healthMetrics.networkLatency,
      timeSinceLastSuccess: Date.now() - healthMetrics.lastHealthCheck,
      circuitBreakerStatus: (syncStatus === 'failed' ? 'open' : 'closed') as 'open' | 'closed',
      pendingFallbacks: pendingMovesCount,
      reconciliationStatus: reconciliationStats.status,
      conflictsResolved: reconciliationStats.autoResolved + reconciliationStats.manualResolved
    };
  }, [getStateHealth, getHealthStatus, getReconciliationStats, healthMetrics, syncStatus, pendingMovesCount]);

  // Executar testes de integração completos
  const handleRunTests = React.useCallback(async () => {
    if (isRunningTests) return;
    
    try {
      await runIntegrationTests({
        gameState,
        playersState,
        playPiece,
        shouldAllowRequest: () => syncStatus !== 'failed',
        recordFailure: recordError,
        reconcileStates: reconcileStates,
        validateGameData: (gameState, playersState) => ({ valid: true, gameState, playersState })
      });
    } catch (error) {
      console.error('❌ Erro nos testes de integração:', error);
      recordError(1000, error as any);
      toast.error('Erro ao executar testes');
    }
  }, [isRunningTests, runIntegrationTests, gameState, playersState, playPiece, syncStatus, recordError, reconcileStates]);
  
  const handleResetMetrics = React.useCallback(() => {
    resetMetrics();
    toast.info('Métricas resetadas');
  }, [resetMetrics]);

  // Hook para funcionalidades de depuração
  const { showHealthDashboard, setShowHealthDashboard } = useGameDebug({
    onRunTests: handleRunTests,
    onResetMetrics: handleResetMetrics,
    onForceSync: forceSync,
  });
  
  // Handlers para resolução de conflitos
  const handleResolveConflict = (conflictId: string, resolution: 'use_local' | 'use_server' | 'merge', mergedValue?: any) => {
    resolveCriticalConflict(conflictId, resolution, mergedValue);
  };

  const handleResolveAllConflicts = (resolution: 'use_local' | 'use_server') => {
    criticalConflicts.forEach(conflict => {
      resolveCriticalConflict(conflict.id, resolution);
    });
  };

  const handleDismissConflicts = () => {
    console.log('🚫 Usuário escolheu ignorar conflitos');
    toast.warning('Conflitos ignorados - pode haver inconsistências');
  };

  if (gameState.status !== 'active') {
    return (
      <GameLoadingScreen 
        gameStatus={gameState.status}
        playersCount={playersState.length}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black overflow-hidden">
      <GamePlayersHeader gameId={gameState.id} />
      
      <ActionFeedback 
        isProcessing={isProcessingMove}
        action={currentAction as ActionType}
      />

      <GameHealthIndicator
        connectionStatus={syncStatus === 'synced' ? 'connected' : syncStatus === 'pending' ? 'reconnecting' : 'disconnected'}
        serverHealth={systemHealth}
        pendingMovesCount={pendingMovesCount}
        onHealthClick={() => setShowHealthDashboard(true)}
      />

      {/* System Health Dashboard completo */}
      <SystemHealthDashboard
        healthStatus={getHealthStatus()}
        testResults={getTestSummary()}
        isVisible={showHealthDashboard}
        onClose={() => setShowHealthDashboard(false)}
      />

      {/* Dialog de resolução de conflitos */}
      <ConflictResolutionDialog
        isVisible={criticalConflicts.length > 0}
        conflicts={criticalConflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
        onDismiss={handleDismissConflicts}
      />
      
      {/* Debug info completo com todos os monitores */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/90 text-white p-3 rounded text-xs max-w-xs z-30">
          <div className="space-y-1">
            <div className="text-green-400 font-bold">🎯 Sistema Unificado v1.0</div>
            <div>Sync: <span className={syncStatus === 'synced' ? 'text-green-400' : 'text-red-400'}>{syncStatus}</span></div>
            <div>Pending: {pendingMovesCount}</div>
            <div>Health: {systemHealth.isHealthy ? '✅' : '⚠️'} ({systemHealth.successRate.toFixed(1)}%)</div>
            <div>Conflicts: {criticalConflicts.length}</div>
            <div>Reconciliation: {reconciliationStatus}</div>
            <div>Response: {systemHealth.serverResponseTime}ms</div>
          </div>
          
          <div className="flex gap-1 mt-2 flex-wrap">
            <button 
              onClick={forceSync}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Sync
            </button>
            <button 
              onClick={() => setShowHealthDashboard(true)}
              className="bg-green-600 px-2 py-1 rounded text-xs"
            >
              Health
            </button>
            <button 
              onClick={handleRunTests}
              className="bg-purple-600 px-2 py-1 rounded text-xs"
              disabled={isRunningTests}
            >
              {isRunningTests ? '⏳' : 'Test'}
            </button>
            <button 
              onClick={handleResetMetrics}
              className="bg-orange-600 px-2 py-1 rounded text-xs"
            >
              Reset
            </button>
          </div>
          
          <div className="text-xs mt-2 text-gray-400">
            Ctrl+H: Health | Ctrl+T: Tests | Ctrl+R: Reset | Ctrl+S: Sync
          </div>
        </div>
      )}
      
      <WinnerDialog 
        winner={winState.winner}
        winType={winState.winType}
        isVisible={winState.hasWinner}
        currentUserId={user?.id}
      />
      
      {isMobile ? (
        <GameMobileLayout
          opponents={opponents}
          placedPieces={placedPieces}
          currentUserPlayer={currentUserPlayer}
          gameHandlers={gameHandlers}
          playPiece={playPiece}
          isProcessingMove={isProcessingMove}
          timeLeft={timeLeft}
          isWarning={isWarning}
        />
      ) : (
        <GameDesktopLayout
          opponents={opponents}
          placedPieces={placedPieces}
          currentUserPlayer={currentUserPlayer}
          gameHandlers={gameHandlers}
          playPiece={playPiece}
          isProcessingMove={isProcessingMove}
          timeLeft={timeLeft}
          isWarning={isWarning}
        />
      )}
    </div>
  );
};

export default React.memo(Game2Room);
