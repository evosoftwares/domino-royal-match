
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHybridGameEngine } from '@/hooks/useHybridGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import { useGameDataProcessing } from '@/hooks/useGameDataProcessing';
import { useGameHandlers } from '@/hooks/useGameHandlers';
import GameLoadingScreen from './game/GameLoadingScreen';
import GameMobileLayout from './game/GameMobileLayout';
import GameDesktopLayout from './game/GameDesktopLayout';
import { Wifi, WifiOff, RotateCcw } from 'lucide-react';

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
  
  const {
    gameState,
    playersState,
    playPiece,
    passTurn,
    playAutomatic,
    isMyTurn,
    isProcessingMove,
    currentAction,
    retryCount,
    pendingMovesCount,
    connectionStatus
  } = useHybridGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

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

  const gameHandlers = useGameHandlers({
    gameState,
    currentUserPlayer,
    isMyTurn,
    isProcessingMove,
    playPiece,
    passTurn
  });

  const { timeLeft, isWarning } = useOptimizedGameTimer({
    isMyTurn: isMyTurn,
    onTimeout: () => {
      if (!isProcessingMove) {
        gameHandlers.handleAutoPlay();
      }
    },
    isGameActive: gameState.status === 'active',
  });

  const winState = useGameWinCheck({
    players: processedPlayers,
    gameStatus: gameState.status
  });

  // Helper para ícone de conexão
  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'reconnecting':
        return <RotateCcw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <Wifi className="w-4 h-4 text-gray-400" />;
    }
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
        action={currentAction}
      />

      {/* Status de conexão e sincronização */}
      <div className="fixed top-16 right-4 z-40 space-y-2">
        {/* Status de conexão */}
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

        {/* Indicador de sincronização */}
        {(retryCount > 0 || pendingMovesCount > 0) && (
          <div className="bg-blue-900/90 backdrop-blur-sm rounded-lg p-2 border border-blue-600/50 shadow-lg">
            <p className="text-xs text-blue-200">
              {retryCount > 0 ? `Sincronizando... ${retryCount}/3` : `${pendingMovesCount} ação(ões) pendente(s)`}
            </p>
          </div>
        )}
      </div>
      
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
