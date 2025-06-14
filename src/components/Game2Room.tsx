
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalFirstGameEngine } from '@/hooks/useLocalFirstGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { useStateValidator } from '@/hooks/useStateValidator';
import { usePersistentQueue } from '@/hooks/usePersistentQueue';
import { useSmartReconciliation } from '@/hooks/useSmartReconciliation';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import ConflictResolutionDialog from './game/ConflictResolutionDialog';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import { useGameDataProcessing } from '@/hooks/useGameDataProcessing';
import { useGameHandlers } from '@/hooks/useGameHandlers';
import GameLoadingScreen from './game/GameLoadingScreen';
import GameMobileLayout from './game/GameMobileLayout';
import GameDesktopLayout from './game/GameDesktopLayout';
import GameHealthIndicator from './game/GameHealthIndicator';
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
  
  // Engine de jogo local-first com Two-Phase Commit
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
  } = useLocalFirstGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

  // Sistema de reconciliação inteligente
  const {
    reconcileStates,
    resolveCriticalConflict,
    forceReconciliation,
    reconciliationStatus,
    criticalConflicts,
    getReconciliationStats
  } = useSmartReconciliation({
    onStateReconciled: (reconciledGameState, reconciledPlayersState) => {
      console.log('🔄 Estados reconciliados aplicados');
      // O LocalFirstGameEngine já gerencia a atualização de estado
    },
    onCriticalConflict: (conflicts) => {
      console.error('🚨 Conflitos críticos detectados:', conflicts);
      toast.error(`${conflicts.length} conflito${conflicts.length > 1 ? 's' : ''} crítico${conflicts.length > 1 ? 's' : ''} detectado${conflicts.length > 1 ? 's' : ''}`);
    }
  });

  // Fila persistente para recuperação
  const persistentQueue = usePersistentQueue({
    gameId: gameState.id,
    maxItems: 30,
    maxAge: 600000 // 10 minutos
  });

  // Validação contínua de estado
  useStateValidator({
    gameState,
    playersState,
    onCorruption: (result) => {
      console.error('💥 Corrupção detectada:', result);
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

  // Health do sistema - agora usando dados do Two-Phase Commit
  const systemHealth = React.useMemo(() => {
    const stateHealth = getStateHealth();
    const queueStats = persistentQueue.getStats();
    const reconciliationStats = getReconciliationStats();
    
    return {
      isHealthy: stateHealth.isHealthy && syncStatus !== 'failed' && reconciliationStats.pendingCriticalConflicts === 0,
      successRate: reconciliationStats.successRate,
      serverResponseTime: 150,
      timeSinceLastSuccess: Date.now() - stateHealth.lastSyncAttempt,
      circuitBreakerStatus: (syncStatus === 'failed' ? 'open' : 'closed') as 'open' | 'closed',
      pendingFallbacks: queueStats.total
    };
  }, [getStateHealth, syncStatus, persistentQueue, getReconciliationStats]);

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
      />

      {/* Dialog de resolução de conflitos */}
      <ConflictResolutionDialog
        isVisible={criticalConflicts.length > 0}
        conflicts={criticalConflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAllConflicts}
        onDismiss={handleDismissConflicts}
      />
      
      {/* Debug info atualizado com Two-Phase Commit e Reconciliação */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
          <div>Sync: {syncStatus}</div>
          <div>Pending: {pendingMovesCount}</div>
          <div>Queue: {persistentQueue.size}</div>
          <div>Conflicts: {criticalConflicts.length}</div>
          <div>Reconciliation: {reconciliationStatus}</div>
          <div>Stats: {JSON.stringify(debugInfo.stats)}</div>
          <button 
            onClick={forceSync}
            className="bg-blue-600 px-2 py-1 rounded mt-1 text-xs mr-1"
          >
            Force Sync
          </button>
          <button 
            onClick={() => forceReconciliation(gameState, gameState, playersState, playersState)}
            className="bg-purple-600 px-2 py-1 rounded mt-1 text-xs"
          >
            Force Reconcile
          </button>
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
