import React from 'react';
import { PlayerData } from '@/types/game';

// Definimos as props que o componente recebe
interface PlayerUIProps {
  player: PlayerData;
}

const PlayerUI: React.FC<PlayerUIProps> = ({ player }) => {
  // Para debug: você pode ver que isso só roda para quem realmente mudou
  console.log(`Renderizando jogador: ${player.profiles?.full_name || `Jogador ${player.position}`}`);

  return (
    <div className="player-card bg-slate-800/50 rounded-lg p-3 border border-slate-600/30">
      <div className="flex items-center space-x-3">
        {player.profiles?.avatar_url ? (
          <img 
            src={player.profiles.avatar_url} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full object-cover border-2 border-purple-400/50"
          />
        ) : (
          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {(player.profiles?.full_name || `J${player.position}`).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-medium truncate">
            {player.profiles?.full_name || `Jogador ${player.position}`}
          </p>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-purple-300">
              Peças: {Array.isArray(player.hand) ? player.hand.length : 0}
            </span>
            {player.position && (
              <span className="text-slate-400">
                Pos: {player.position}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// A MÁGICA: Memoizamos o componente do jogador individual.
// Agora, se apenas os dados de um jogador mudarem, SÓ o componente desse jogador será re-renderizado.
// O React verá que a prop 'player' para os outros jogadores não mudou e pulará a re-renderização deles.
export default React.memo(PlayerUI); 