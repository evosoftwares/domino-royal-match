
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
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { usePlayerOrder } from '@/hooks/usePlayerOrder';
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

  // Verificação da ordem dos jogadores
  const playerOrder = usePlayerOrder({
    players: playersState,
    currentPlayerTurn: gameState.current_player_turn
  });

  // Auto-refresh da página a cada 10 segundos
  const { manualRefresh } = useAutoRefresh({
    intervalMs: 10000,
    isActive: gameState.status === 'active',
    onRefresh: () => {
      console.log('🔄 Auto-refresh executado, forçando sincronização');
      forceSync();
    }
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
    timeLeft: 0,
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
      
      {/* Debug info atualizado com timer, solicitações e ordem dos jogadores */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black/90 text-white p-3 rounded text-xs max-w-sm z-30">
          <div className="space-y-1">
            <div className="text-green-400 font-bold">🎯 Timer & Ordem v1.2</div>
            <div>Sync: <span className={syncStatus === 'synced' ? 'text-green-400' : 'text-red-400'}>{syncStatus}</span></div>
            <div>My Turn: {isMyTurn ? '✅' : '❌'}</div>
            <div>Timer: <span className={timeLeft <= 3 ? 'text-red-400' : 'text-yellow-400'}>{timeLeft}s</span></div>
            <div>Warning: {isWarning ? '⚠️' : '✅'}</div>
            <div>Processing: {isProcessingMove ? '⏳' : '✅'}</div>
            <div>Current Player: {gameState.current_player_turn === user?.id ? 'EU' : 'OUTRO'}</div>
            <div>Ordem Válida: {playerOrder.isOrderValid ? '✅' : '❌'}</div>
            <div className="text-blue-400">📝 Pendentes: {solicitationsMonitor.pendingSolicitations.length}</div>
            <div className="text-yellow-400">⚙️ Processando: {solicitationsMonitor.processingCount}</div>
            <div className="text-green-400">✅ Completas: {solicitationsMonitor.recentlyCompleted.length}</div>
            
            {/* Debug da ordem dos jogadores */}
            <div className="border-t border-gray-600 pt-1 mt-2">
              <div className="text-purple-400 font-bold">Ordem dos Jogadores:</div>
              {playerOrder.debugInfo.playersOrder.map((p, index) => (
                <div key={p.userId} className={`text-xs ${p.isCurrent ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {index + 1}. {p.name} {p.isCurrent ? '👑' : ''}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex gap-1 mt-2">
            <button 
              onClick={forceSync}
              className="bg-blue-600 px-2 py-1 rounded text-xs"
            >
              Sync
            </button>
            <button 
              onClick={manualRefresh}
              className="bg-green-600 px-2 py-1 rounded text-xs"
            >
              Refresh
            </button>
            <button 
              onClick={solicitationsMonitor.refresh}
              className="bg-purple-600 px-2 py-1 rounded text-xs"
            >
              Sol.
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
