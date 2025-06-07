import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import { generateDominoPieces, distributePieces, DominoPieceType } from '@/utils/dominoUtils';
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
const GameRoom: React.FC = () => {
  const {
    gameId
  } = useParams<{
    gameId: string;
  }>();
  const {
    user
  } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [placedPieces, setPlacedPieces] = useState<DominoPieceType[]>([]);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameData, setGameData] = useState<any>(null);

  // Carregar dados do jogo do Supabase
  const loadGameData = async () => {
    if (!gameId || !user) return;
    try {
      // Buscar dados do jogo
      const {
        data: game,
        error: gameError
      } = await supabase.from('games').select('*').eq('id', gameId).single();
      if (gameError) throw gameError;

      // Buscar jogadores do jogo com dados do perfil
      const {
        data: gamePlayers,
        error: playersError
      } = await supabase.from('game_players').select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `).eq('game_id', gameId).order('position');
      if (playersError) throw playersError;
      setGameData(game);

      // Converter dados dos jogadores para formato interno
      const formattedPlayers: Player[] = gamePlayers.map(player => ({
        id: player.user_id,
        name: (player.profiles as any)?.full_name || 'Jogador',
        pieces: player.hand ? convertHandToPieces(player.hand as any[]) : [],
        isCurrentPlayer: game.current_player_turn === player.user_id,
        position: player.position
      }));
      setPlayers(formattedPlayers);

      // Converter board_state para placedPieces se existir
      if (game.board_state && typeof game.board_state === 'object' && (game.board_state as any).pieces) {
        const boardState = game.board_state as {
          pieces: any[];
        };
        const boardPieces = boardState.pieces.map((piece: any, index: number) => ({
          id: `board-${index}`,
          top: piece.piece[0],
          bottom: piece.piece[1]
        }));
        setPlacedPieces(boardPieces);
      }
      setGameStarted(game.status === 'active' || game.status === 'starting');
      if (game.status === 'starting') {
        toast.info('Jogo iniciando... Distribuindo peças...');
      } else if (game.status === 'active') {
        toast.success('Jogo ativo! Sua vez de jogar!');
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados do jogo:', error);
      toast.error('Erro ao carregar o jogo');
    }
  };

  // Converter dados da mão do Supabase para DominoPieceType
  const convertHandToPieces = (hand: any[]): DominoPieceType[] => {
    if (!Array.isArray(hand)) return [];
    return hand.map((piece, index) => ({
      id: `piece-${index}`,
      top: piece[0] || piece.left || 0,
      bottom: piece[1] || piece.right || 0
    }));
  };

  // Subscrição em tempo real para mudanças no jogo
  useEffect(() => {
    loadGameData();
    if (!gameId) return;
    const gameChannel = supabase.channel(`game-room-${gameId}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`
    }, payload => {
      console.log('Atualização do jogo:', payload);
      loadGameData();
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_players',
      filter: `game_id=eq.${gameId}`
    }, payload => {
      console.log('Atualização dos jogadores:', payload);
      loadGameData();
    }).subscribe();
    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameId, user]);

  // Timer do jogador atual
  useEffect(() => {
    if (!gameStarted || gameData?.status !== 'active') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Jogada automática quando o tempo acaba
          handleAutoPlay();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStarted, players, gameData]);
  const handleAutoPlay = async () => {
    const currentPlayer = players.find(p => p.isCurrentPlayer && p.id === user?.id);
    if (currentPlayer && currentPlayer.pieces.length > 0) {
      // Escolhe uma peça aleatória para jogada automática
      const randomPiece = currentPlayer.pieces[Math.floor(Math.random() * currentPlayer.pieces.length)];
      await handlePiecePlayed(randomPiece);
      toast.info("Tempo esgotado! Peça jogada automaticamente.");
    }
  };
  const handlePieceDrag = (piece: DominoPieceType) => {
    setCurrentDraggedPiece(piece);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece) {
      handlePiecePlayed(currentDraggedPiece);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handlePiecePlayed = async (piece: DominoPieceType) => {
    if (!gameId || !user) return;
    const currentPlayer = players.find(p => p.isCurrentPlayer && p.id === user.id);
    if (!currentPlayer) {
      toast.error('Não é a sua vez!');
      return;
    }
    try {
      // Fazer a jogada usando a função do Supabase
      const {
        data,
        error
      } = await supabase.rpc('play_move', {
        p_game_id: gameId,
        p_piece: [piece.top, piece.bottom],
        p_side: placedPieces.length === 0 ? 'center' : 'right'
      });
      if (error) throw error;
      toast.success(data || 'Jogada realizada!');
      setCurrentDraggedPiece(null);
      setTimeLeft(30);

      // Recarregar dados do jogo
      await loadGameData();
    } catch (error: any) {
      console.error('Erro ao fazer jogada:', error);
      toast.error(error.message || 'Erro ao fazer jogada');
    }
  };
  const currentPlayer = players.find(p => p.isCurrentPlayer);
  const otherPlayers = players.filter(p => !p.isCurrentPlayer);
  const userPlayer = players.find(p => p.id === user?.id);
  if (!gameStarted) {
    return <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-purple-200 text-lg">Aguardando início do jogo...</p>
          <p className="text-purple-300 text-sm mt-2">
            Status: {gameData?.status || 'Carregando...'}
          </p>
        </div>
      </div>;
  }
  return <div className="max-w-7xl mx-auto space-y-6">
      {/* Informações da partida */}
      

      {/* Área dos outros jogadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherPlayers.map(player => <div key={player.id} className="bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border border-purple-600/20">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-3 h-3 rounded-full ${player.isCurrentPlayer ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-purple-200 font-medium">{player.name}</span>
              {player.isCurrentPlayer && <span className="text-xs text-green-400">(Vez)</span>}
            </div>
            <div className="text-2xl font-bold text-white">{player.pieces.length}</div>
            <div className="text-purple-300 text-sm">peças restantes</div>
          </div>)}
      </div>

      {/* Tabuleiro central */}
      <GameBoard placedPieces={placedPieces} onDrop={handleDrop} onDragOver={handleDragOver} />

      {/* Área do jogador atual */}
      {userPlayer && <PlayerArea playerPieces={userPlayer.pieces} onPieceDrag={handlePieceDrag} isCurrentPlayer={userPlayer.isCurrentPlayer} playerName={userPlayer.name} timeLeft={timeLeft} />}
    </div>;
};
export default GameRoom;