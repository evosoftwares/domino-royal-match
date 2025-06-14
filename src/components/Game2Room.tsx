
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHybridGameEngine } from '@/hooks/useHybridGameEngine';
import { useOptimizedGameTimer } from '@/hooks/useOptimizedGameTimer';
import { useCommunicationRobustness } from '@/hooks/useCommunicationRobustness';
import WinnerDialog from './WinnerDialog';
import ActionFeedback from './ActionFeedback';
import { useGameWinCheck } from '@/hooks/useGameWinCheck';
import { useGameDataProcessing } from '@/hooks/useGameDataProcessing';
import { useGameHandlers } from '@/hooks/useGameHandlers';
import GameLoadingScreen from './game/GameLoadingScreen';
import GameMobileLayout from './game/GameMobileLayout';
import GameDesktopLayout from './game/GameDesktopLayout';
import GameHealthIndicator from './game/GameHealthIndicator';

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
    pendingMovesCount,
    connectionStatus
  } = useHybridGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

  const {
    robustPlayMove,
    robustPassTurn,
    getSystemHealth,
    isCircuitOpen,
    healthMetrics
  } = useCommunicationRobustness(gameState.id);

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

  // Wrapper para usar comunicação robusta
  const enhancedPlayPiece = async (piece: any) => {
    try {
      if (isCircuitOpen) {
        console.warn('⛔ Circuit breaker aberto, usando fallback local');
        return await playPiece(piece);
      }
      
      const result = await robustPlayMove(piece);
      return result !== null;
    } catch (error) {
      console.error('Erro em enhancedPlayPiece:', error);
      return await playPiece(piece);
    }
  };

  const enhancedPassTurn = async () => {
    try {
      if (isCircuitOpen) {
        console.warn('⛔ Circuit breaker aberto, usando fallback local');
        return await passTurn();
      }
      
      const result = await robustPassTurn();
      return result !== null;
    } catch (error) {
      console.error('Erro em enhancedPassTurn:', error);
      return await passTurn();
    }
  };

  const gameHandlers = useGameHandlers({
    gameState,
    currentUserPlayer,
    isMyTurn,
    isProcessingMove,
    playPiece: enhancedPlayPiece,
    passTurn: enhancedPassTurn
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
        connectionStatus={connectionStatus}
        serverHealth={getSystemHealth()}
        pendingMovesCount={pendingMovesCount}
      />
      
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
          playPiece={enhancedPlayPiece}
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
          playPiece={enhancedPlayPiece}
          isProcessingMove={isProcessingMove}
          timeLeft={timeLeft}
          isWarning={isWarning}
        />
      )}
    </div>
  );
};

export default React.memo(Game2Room);
