
import { useState, useEffect } from 'react';
import { GameData, PlayerData } from '@/types/game';

interface UseGameStateProps {
  initialGameData: GameData;
  initialPlayers: PlayerData[];
}

export const useGameState = ({ initialGameData, initialPlayers }: UseGameStateProps) => {
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  return {
    gameState,
    setGameState,
    playersState,
    setPlayersState,
  };
};
