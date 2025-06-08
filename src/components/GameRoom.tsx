
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DominoPieceType } from '@/utils/dominoUtils';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import OpponentArea from './OpponentArea';
import { cn } from '@/lib/utils';

interface GameData {
  id: string;
  status: string;
  prize_amount: number;
  current_player_turn: string | null;
  board_state: any;
  created_at: string;
}

interface PlayerProfile {
  full_name: string;
  avatar_url: string;
}

interface PlayerData {
  id: string;
  user_id: string;
  position: number;
  hand: any;
  status: string;
  profiles: PlayerProfile;
}

interface GameRoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const GameRoom: React.FC<GameRoomProps> = ({ gameData: initialGameData, players: initialPlayers }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState(initialGameData);
  const [playersState, setPlayersState] = useState(initialPlayers);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  // Função para buscar dados atualizados do jogo
  const fetchGameData = useCallback(async () => {
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameState.id)
        .single();

      if (gameError) {
        console.error('Erro ao buscar dados do jogo:', gameError);
        return;
      }

      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select(`
          *,
          profiles!game_players_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('game_id', gameState.id)
        .order('position');

      if (playersError) {
        console.error('Erro ao buscar jogadores:', playersError);
        return;
      }

      setGameState(game);
      setPlayersState(players || []);
    } catch (error) {
      console.error('Erro inesperado ao buscar dados:', error);
    }
  }, [gameState.id]);

  // Real-time subscriptions
  useEffect(() => {
    const gameChannel = supabase.channel(`game-${gameState.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameState.id}`
      }, (payload) => {
        console.log('Game updated:', payload);
        if (payload.new) {
          setGameState(payload.new as GameData);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameState.id}`
      }, (payload) => {
        console.log('Players updated:', payload);
        fetchGameData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameState.id, fetchGameData]);

  // Timer do turno
  useEffect(() => {
    if (gameState.status !== 'active') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (gameState.current_player_turn === user?.id) {
            handleAutoPlay();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.current_player_turn, gameState.status]);

  // Reset timer quando muda o turno
  useEffect(() => {
    setTimeLeft(30);
  }, [gameState.current_player_turn]);

  // Processar dados dos jogadores
  const processedPlayers = playersState.map(player => {
    let pieces: DominoPieceType[] = [];
    
    // Corrigir parsing da mão do jogador
    if (player.hand && Array.isArray(player.hand)) {
      pieces = player.hand.map((piece: any, index: number) => {
        // Verificar se é array de números [top, bottom]
        if (Array.isArray(piece) && piece.length === 2) {
          return {
            id: `${player.user_id}-piece-${index}`,
            top: piece[0],
            bottom: piece[1]
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    return {
      id: player.user_id,
      name: player.profiles?.full_name || 'Jogador',
      pieces,
      isCurrentPlayer: gameState.current_player_turn === player.user_id,
      position: player.position,
      originalData: player
    };
  });

  const userPlayer = processedPlayers.find(p => p.id === user?.id);
  const otherPlayers = processedPlayers.filter(p => p.id !== user?.id).slice(0, 3);

  // Processar peças do tabuleiro
  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => ({
      id: `board-piece-${index}`,
      top: boardPiece.piece[0],
      bottom: boardPiece.piece[1]
    }));
  }

  const isFirstMove = placedPieces.length === 0;

  // Obter extremidades abertas
  const getOpenEnds = () => {
    if (isFirstMove) return { left: null, right: null };
    
    return {
      left: gameState.board_state?.left_end || null,
      right: gameState.board_state?.right_end || null
    };
  };

  // Verificar se peça pode ser jogada
  const canPiecePlay = (piece: DominoPieceType): boolean => {
    if (isFirstMove) return true;
    
    const { left, right } = getOpenEnds();
    if (left === null && right === null) return false;
    
    return piece.top === left || piece.bottom === left || 
           piece.top === right || piece.bottom === right;
  };

  // Determinar lado da jogada
  const determineSide = (piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left';
    
    const { left, right } = getOpenEnds();
    
    if ((piece.top === left || piece.bottom === left) && left !== null) return 'left';
    if ((piece.top === right || piece.bottom === right) && right !== null) return 'right';
    
    return null;
  };

  // Handlers de drag and drop
  const handlePieceDrag = (piece: DominoPieceType) => {
    console.log('Piece drag started:', piece);
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop event triggered with piece:', currentDraggedPiece);
    
    if (currentDraggedPiece && userPlayer?.isCurrentPlayer && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  // Jogar peça
  const playPiece = async (piece: DominoPieceType) => {
    console.log('Attempting to play piece:', piece);
    
    if (isProcessingMove) {
      toast.error('Aguarde a jogada anterior ser processada');
      return;
    }

    if (!user || gameState.current_player_turn !== user.id) {
      toast.error('Não é sua vez de jogar');
      return;
    }

    if (!canPiecePlay(piece)) {
      toast.error('Esta peça não pode ser jogada nas extremidades disponíveis');
      return;
    }

    const side = determineSide(piece);
    if (!side) {
      toast.error('Não foi possível determinar onde jogar esta peça');
      return;
    }

    setIsProcessingMove(true);

    try {
      const pieceArray = [piece.top, piece.bottom];
      console.log('Calling play_move with:', { piece: pieceArray, side });

      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceArray,
        p_side: side
      });

      if (error) {
        console.error('Erro na RPC play_move:', error);
        toast.error(`Erro ao jogar peça: ${error.message}`);
        return;
      }

      console.log('RPC response:', data);

      if (data && data.includes('ERRO:')) {
        toast.error(data);
        return;
      }

      if (data && data.includes('venceu')) {
        toast.success('🎉 Você venceu o jogo!');
      } else {
        toast.success('Jogada realizada com sucesso!');
      }

      // Forçar atualização dos dados
      await fetchGameData();

    } catch (error) {
      console.error('Erro inesperado ao jogar peça:', error);
      toast.error('Erro inesperado ao jogar peça');
    } finally {
      setIsProcessingMove(false);
    }
  };

  // Auto play
  const handleAutoPlay = async () => {
    if (!userPlayer?.isCurrentPlayer || isProcessingMove) return;

    const playablePiece = userPlayer.pieces.find(piece => canPiecePlay(piece));
    if (!playablePiece) {
      toast.error('Nenhuma peça pode ser jogada');
      return;
    }

    await playPiece(playablePiece);
  };

  if (gameState.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <div className="text-center p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Aguardando início do jogo...</h2>
          <p className="text-purple-200">Status: {gameState.status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Área dos oponentes no topo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {otherPlayers.map(player => (
            <OpponentArea
              key={player.id}
              player={player}
              isCurrentPlayer={player.isCurrentPlayer}
              pieceCount={player.pieces.length}
            />
          ))}
        </div>

        {/* Mesa de jogo centralizada */}
        <GameBoard
          placedPieces={placedPieces}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="mb-6"
        />

        {/* Área do jogador atual */}
        {userPlayer && (
          <PlayerArea
            playerPieces={userPlayer.pieces}
            onPieceDrag={handlePieceDrag}
            onPiecePlay={playPiece}
            isCurrentPlayer={userPlayer.isCurrentPlayer}
            playerName={userPlayer.name}
            timeLeft={timeLeft}
            onAutoPlay={handleAutoPlay}
            isProcessingMove={isProcessingMove}
            canPiecePlay={canPiecePlay}
          />
        )}
      </div>
    </div>
  );
};

export default GameRoom;
