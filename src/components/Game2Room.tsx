
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GameData, PlayerData } from '@/types/game';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSimplifiedGameEngine } from '@/hooks/useSimplifiedGameEngine';
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
    pendingMovesCount,
    connectionStatus
  } = useSimplifiedGameEngine({
    gameData: initialGameData,
    players: initialPlayers,
    userId: user?.id,
  });

  // Sistema de comunicação robusta
  const {
    robustPlayMove,
    robustPassTurn,
    getSystemHealth,
    isCircuitOpen,
    healthMetrics
  } = useCommunicationRobustness(gameState.id);

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

  // Wrapper para comunicação robusta integrada
  const enhancedPlayPiece = async (piece: any) => {
    try {
      if (isCircuitOpen) {
        console.warn('⛔ Circuit breaker aberto, usando engine local');
        return await playPiece(piece);
      }
      
      // Tentar comunicação robusta primeiro
      const result = await robustPlayMove(piece);
      if (result !== null) return true;
      
      // Fallback para engine local
      return await playPiece(piece);
    } catch (error) {
      console.error('Erro em enhancedPlayPiece:', error);
      return await playPiece(piece);
    }
  };

  const enhancedPassTurn = async () => {
    try {
      if (isCircuitOpen) {
        console.warn('⛔ Circuit breaker aberto, usando engine local');
        return await passTurn();
      }
      
      // Tentar comunicação robusta primeiro
      const result = await robustPassTurn();
      if (result !== null) return true;
      
      // Fallback para engine local
      return await passTurn();
    } catch (error) {
      console.error('Erro em enhancedPassTurn:', error);
      return await passTurn();
    }
  };

  // Handlers do jogo
  const gameHandlers = useGameHandlers({
    gameState,
    currentUserPlayer,
    isMyTurn,
    isProcessingMove,
    playPiece: enhancedPlayPiece,
    passTurn: enhancedPassTurn
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
