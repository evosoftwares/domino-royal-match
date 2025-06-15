
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSimpleGameEngine } from '@/hooks/useSimpleGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { usePlayerPresence } from '@/hooks/usePlayerPresence';
import { useOfflinePlayerMonitor } from '@/hooks/useOfflinePlayerMonitor';
import { useAutoPlaySolicitations } from '@/hooks/useAutoPlaySolicitations';
import { useSolicitationsMonitor } from '@/hooks/useSolicitationsMonitor';
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

  // Sistema de solicitações automáticas
  const allPlayerIds = React.useMemo(() => 
    playersState.map(p => p.user_id), 
    [playersState]
  );

  const solicitationsMonitor = useSolicitationsMonitor({
    gameId: gameState.id,
    isActive: gameState.status === 'active'
  });

  const { createSolicitation } = useAutoPlaySolicitations({
    gameId: gameState.id,
    isGameActive: gameState.status === 'active',
    timeLeft: 0, // Será atualizado pelo callback do timer
    allPlayerIds
  });

  // Timer otimizado com integração corrigida
  const { timeLeft, isWarning } = useOptimizedGameTimer({
    isMyTurn: isMyTurn,
    onTimeout: () => {
      console.log('⏰ Timer expirado para jogador atual:', gameState.current_player_turn);
      if (!isProcessingMove && gameState.current_player_turn) {
        createSolicitation(gameState.current_player_turn);
      }
    },
    onTimeoutWarning: (currentTimeLeft) => {
      // Criar solicitações preventivas quando restam 2 segundos
      if (currentTimeLeft === 2 && gameState.current_player_turn) {
        console.log('⚠️ Criando solicitação preventiva para jogador atual:', gameState.current_player_turn);
        createSolicitation(gameState.current_player_turn);
      }
    },
    isGameActive: gameState.status === 'active',
    timerDuration: 10
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

  // Verificação de vitória
  const winState = useGameWinCheck({
    players: processedPlayers,
    gameStatus: gameState.status
  });

  // Health do sistema com solicitações
  const systemHealth = React.useMemo(() => ({
    isHealthy: syncStatus === 'synced' && solicitationsMonitor.totalPendingCount < 5,
    successRate: syncStatus === 'synced' ? 100 : 0,
    serverResponseTime: 150,
    timeSinceLastSuccess: Date.now(),
    circuitBreakerStatus: 'closed' as const,
    pendingFallbacks: solicitationsMonitor.totalPendingCount,
    reconciliationStatus: 'stable',
    conflictsResolved: 0
  }), [syncStatus, solicitationsMonitor.totalPendingCount]);
  
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
        isProcessing={isProcessingMove || solicitationsMonitor.processingCount > 0}
        action={currentAction as ActionType}
      />

      <GameHealthIndicator
        connectionStatus={syncStatus === 'synced' ? 'connected' : syncStatus === 'pending' ? 'reconnecting' : 'disconnected'}
        serverHealth={systemHealth}
        pendingMovesCount={solicitationsMonitor.totalPendingCount}
        onHealthClick={() => {}}
      />
      
      {/* Debug info atualizado com timer e solicitações */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/90 text-white p-3 rounded text-xs max-w-xs z-30">
          <div className="space-y-1">
            <div className="text-green-400 font-bold">🎯 Timer & Solicitações v1.1</div>
            <div>Sync: <span className={syncStatus === 'synced' ? 'text-green-400' : 'text-red-400'}>{syncStatus}</span></div>
            <div>My Turn: {isMyTurn ? '✅' : '❌'}</div>
            <div>Timer: <span className={timeLeft <= 3 ? 'text-red-400' : 'text-yellow-400'}>{timeLeft}s</span></div>
            <div>Warning: {isWarning ? '⚠️' : '✅'}</div>
            <div>Processing: {isProcessingMove ? '⏳' : '✅'}</div>
            <div>Current Player: {gameState.current_player_turn === user?.id ? 'EU' : 'OUTRO'}</div>
            <div className="text-blue-400">📝 Pendentes: {solicitationsMonitor.pendingSolicitations.length}</div>
            <div className="text-yellow-400">⚙️ Processando: {solicitationsMonitor.processingCount}</div>
            <div className="text-green-400">✅ Completas: {solicitationsMonitor.recentlyCompleted.length}</div>
          </div>
          
          <div className="flex gap-1 mt-2">
            <button 
              onClick={forceSync}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Sync
            </button>
            <button 
              onClick={solicitationsMonitor.refresh}
              className="bg-green-600 px-2 py-1 rounded text-xs"
            >
              Refresh
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
