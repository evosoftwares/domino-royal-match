import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSimpleGameEngine } from '@/hooks/useSimpleGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { useOfflinePlayerMonitor } from '@/hooks/useOfflinePlayerMonitor';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import { useGameDataProcessing } from '@/hooks/useGameDataProcessing';
import { useSimpleGameHandlers } from '@/hooks/useSimpleGameHandlers';
import GameLoadingScreen from './game/GameLoadingScreen';
import GameMobileLayout from './game/GameMobileLayout';
import GameDesktopLayout from './game/GameDesktopLayout';
import GameHealthIndicator from './game/GameHealthIndicator';

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
  
  // Engine de jogo simplificado
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
    forceSync,
    debugInfo
  } = useSimpleGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

  // Gerenciamento de presença do jogador
  usePlayerPresence({
    gameId: gameState.id,
    isActive: gameState.status === 'active'
  });

  // Monitoramento de jogadores offline
  useOfflinePlayerMonitor({
    gameState,
    isActive: gameState.status === 'active'
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

  // Handlers do jogo simplificados
  const gameHandlers = useSimpleGameHandlers({
    gameState,
    currentUserPlayer,
    isMyTurn,
    isProcessingMove,
    playPiece,
    passTurn,
    playAutomatic
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

  // Health do sistema simplificado
  const systemHealth = React.useMemo(() => ({
    isHealthy: syncStatus === 'synced',
    successRate: syncStatus === 'synced' ? 100 : 0,
    serverResponseTime: 150,
    timeSinceLastSuccess: Date.now(),
    circuitBreakerStatus: 'closed' as const,
    pendingFallbacks: 0,
    reconciliationStatus: 'stable',
    conflictsResolved: 0
  }), [syncStatus]);
  
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
        pendingMovesCount={0}
        onHealthClick={() => {}}
      />
      
      {/* Debug info atualizado */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/90 text-white p-3 rounded text-xs max-w-xs z-30">
          <div className="space-y-1">
            <div className="text-green-400 font-bold">🎯 Sistema com Presença v4.0</div>
            <div>Sync: <span className={syncStatus === 'synced' ? 'text-green-400' : 'text-red-400'}>{syncStatus}</span></div>
            <div>My Turn: {isMyTurn ? '✅' : '❌'}</div>
            <div>Processing: {isProcessingMove ? '⏳' : '✅'}</div>
            <div className="text-blue-400">🟢 Presença ativa</div>
            <div className="text-blue-400">👥 Monitor offline ativo</div>
          </div>
          
          <div className="flex gap-1 mt-2">
            <button 
              onClick={forceSync}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Sync
            </button>
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
