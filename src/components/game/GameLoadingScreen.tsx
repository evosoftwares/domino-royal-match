
import React from 'react';

interface GameLoadingScreenProps {
  gameStatus: string;
  playersCount: number;
}

const GameLoadingScreen: React.FC<GameLoadingScreenProps> = ({
  gameStatus,
  playersCount
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
      <div className="text-center p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Aguardando início do jogo...</h2>
        <p className="text-purple-200">Status: {gameStatus}</p>
        <p className="text-purple-200 mt-2">Jogadores conectados: {playersCount}</p>
      </div>
    </div>
  );
};

export default GameLoadingScreen;
