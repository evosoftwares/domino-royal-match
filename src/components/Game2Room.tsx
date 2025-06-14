
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocalFirstGameEngine } from '@/hooks/useLocalFirstGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { useStateValidator } from '@/hooks/useStateValidator';
import { usePersistentQueue } from '@/hooks/usePersistentQueue';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
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

const Game2Room: React.FC<Game2RoomProps> = ({
  gameData: initialGameData,
  players: initialPlayers,
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Engine de jogo local-first
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

  // Health do sistema
  const systemHealth = React.useMemo(() => {
    const stateHealth = getStateHealth();
    const queueStats = persistentQueue.getStats();
    
    return {
      isHealthy: stateHealth.isHealthy && syncStatus !== 'failed',
      syncStatus,
      pendingOperations: stateHealth.pendingOperations,
      conflictCount: stateHealth.conflictCount,
      queueSize: queueStats.total,
      retryCount: queueStats.retryCount,
      lastSync: stateHealth.lastSyncAttempt,
      connectionStatus: stateHealth.isHealthy ? 'connected' : 'degraded'
    };
  }, [getStateHealth, syncStatus, persistentQueue]);

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
        action={currentAction}
      />

      <GameHealthIndicator
        connectionStatus={systemHealth.connectionStatus as any}
        serverHealth={systemHealth}
        pendingMovesCount={pendingMovesCount}
      />
      
      {/* Debug info para desenvolvimento */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/80 text-white p-2 rounded text-xs max-w-xs">
          <div>Sync: {syncStatus}</div>
          <div>Pending: {pendingMovesCount}</div>
          <div>Queue: {persistentQueue.size}</div>
          <div>Conflicts: {debugInfo.conflictCount}</div>
          <button 
            onClick={forceSync}
            className="bg-blue-600 px-2 py-1 rounded mt-1 text-xs"
          >
            Force Sync
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
