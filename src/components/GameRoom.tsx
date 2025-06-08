import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import { DominoPieceType } from '@/utils/dominoUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
}

// --- NOVO COMPONENTE PARA O CARD DO OPONENTE ---
// Criado para encapsular a lógica de exibição de cada oponente.
const OpponentCard: React.FC<{ player: Player }> = ({ player }) => {
  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border border-purple-600/20">
      <div className="flex items-center justify-between h-full">
        {/* Informações do Jogador (Nome e Status) */}
        <div>
          <div className="flex items-center gap-3">
            <div 
              className={`w-3 h-3 rounded-full transition-colors ${
                player.isCurrentPlayer ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
              }`} 
            />
            <span className="text-purple-200 font-medium">{player.name}</span>
          </div>
          <div className="text-xs mt-1 pl-6">
            {player.isCurrentPlayer ? (
              <span className="text-green-400 font-semibold">Jogando...</span>
            ) : (
              <span className="text-gray-400">Aguardando</span>
            )}
          </div>
        </div>

        {/* Peças restantes como blocos visuais */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: player.pieces.length }).map((_, index) => (
            <div
              key={index}
              className="w-3 h-6 bg-white/70 rounded-sm border border-black/20 shadow-md"
              aria-label="Peça do oponente"
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
};


const GameRoom: React.FC = () => {
  const { gameId } = useParams<{ gameId: string; }>();
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [placedPieces, setPlacedPieces] = useState<DominoPieceType[]>([]);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameData, setGameData] = useState<any>(null);

  const loadGameData = async () => {
    if (!gameId || !user) return;
    try {
      const { data: game, error: gameError } = await supabase.from('games').select('*').eq('id', gameId).single();
      if (gameError) throw gameError;

      const { data: gamePlayers, error: playersError } = await supabase.from('game_players').select(`*, profiles (full_name, avatar_url)`).eq('game_id', gameId).order('position');
      if (playersError) throw playersError;
      setGameData(game);

      const formattedPlayers: Player[] = gamePlayers.map(player => ({
        id: player.user_id,
        name: (player.profiles as any)?.full_name || 'Jogador',
        pieces: player.hand ? (player.hand as any[]).map((p, i) => ({ id: `${player.user_id}-p${i}`, top: p[0], bottom: p[1] })) : [],
        isCurrentPlayer: game.current_player_turn === player.user_id,
        position: player.position
      }));
      setPlayers(formattedPlayers);

      if (game.board_state && typeof game.board_state === 'object' && (game.board_state as any).pieces) {
        const boardState = game.board_state as { pieces: any[]; };
        const boardPieces = boardState.pieces.map((piece: any, index: number) => ({
          id: `board-${index}`,
          top: piece.piece[0],
          bottom: piece.piece[1]
        }));
        setPlacedPieces(boardPieces);
      }
      setGameStarted(game.status === 'active' || game.status === 'starting');
    } catch (error: any) {
      console.error('Erro ao carregar dados do jogo:', error);
      toast.error('Erro ao carregar o jogo');
    }
  };

  // Hooks useEffect para carregar dados e gerenciar o timer (sem alterações)
  useEffect(() => { loadGameData(); /* ... */ }, [gameId, user]);
  useEffect(() => { /* ... */ }, [gameStarted, players, gameData]);

  const handlePieceDrag = (piece: DominoPieceType) => setCurrentDraggedPiece(piece);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece) handlePiecePlayed(currentDraggedPiece);
  };
  
  // Funções de handle (handlePiecePlayed, handleAutoPlay) (sem alterações)
  const handlePiecePlayed = async (piece: DominoPieceType) => { /* ... */ };
  const handleAutoPlay = async () => { /* ... */ };

  // Filtra os jogadores para separar o usuário atual dos oponentes
  const otherPlayers = players.filter(p => p.id !== user?.id);
  const userPlayer = players.find(p => p.id === user?.id);

  if (!gameStarted) {
    return <div className="text-center p-8">Carregando jogo...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* --- ÁREA DOS OUTROS JOGADORES (CORRIGIDA) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherPlayers.map(player => (
          <OpponentCard key={player.id} player={player} />
        ))}
      </div>

      {/* Tabuleiro central */}
      <GameBoard 
        placedPieces={placedPieces} 
        onDrop={handleDrop} 
        onDragOver={handleDragOver} 
      />

      {/* Área do jogador atual */}
      {userPlayer && (
        <PlayerArea 
          playerPieces={userPlayer.pieces} 
          onPieceDrag={handlePieceDrag} 
          isCurrentPlayer={userPlayer.isCurrentPlayer} 
          playerName={userPlayer.name} 
          timeLeft={timeLeft} 
        />
      )}
    </div>
  );
};

export default GameRoom;