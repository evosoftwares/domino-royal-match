
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

  // Atualizar estados quando props mudam
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

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

  // Log para debug
  useEffect(() => {
    console.log('GameRoom - Game State:', gameState);
    console.log('GameRoom - Players State:', playersState);
    console.log('GameRoom - Current User:', user?.id);
  }, [gameState, playersState, user]);

  // Processar dados dos jogadores
  const processedPlayers = playersState.map(player => {
    let pieces: DominoPieceType[] = [];
    
    console.log(`Processing player ${player.profiles?.full_name || 'Unknown'} hand:`, player.hand);
    
    // Verificar se há dados na mão
    if (player.hand && Array.isArray(player.hand)) {
      pieces = player.hand.map((piece: any, index: number) => {
        // Verificar se é array de números [top, bottom]
        if (Array.isArray(piece) && piece.length === 2 && 
            typeof piece[0] === 'number' && typeof piece[1] === 'number') {
          return {
            id: `${player.user_id}-piece-${index}`,
            top: piece[0],
            bottom: piece[1]
          };
        }
        
        // Verificar se é objeto com propriedades top/bottom
        if (piece && typeof piece === 'object' && 
            typeof piece.top === 'number' && typeof piece.bottom === 'number') {
          return {
            id: `${player.user_id}-piece-${index}`,
            top: piece.top,
            bottom: piece.bottom
          };
        }
        
        console.warn('Invalid piece format:', piece);
        return null;
      }).filter(Boolean);
    }
    
    return {
      id: player.user_id,
      name: player.profiles?.full_name || `Jogador ${player.position}`,
      pieces,
      isCurrentPlayer: gameState.current_player_turn === player.user_id,
      position: player.position,
      originalData: player
    };
  });

  console.log('Processed Players:', processedPlayers);

  const userPlayer = processedPlayers.find(p => p.id === user?.id);
  const otherPlayers = processedPlayers.filter(p => p.id !== user?.id);

  console.log('User Player:', userPlayer);
  console.log('Other Players:', otherPlayers);

  // Processar peças do tabuleiro
  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => {
      // Verificar diferentes formatos possíveis
      let piece;
      if (boardPiece.piece && Array.isArray(boardPiece.piece)) {
        piece = boardPiece.piece;
      } else if (Array.isArray(boardPiece)) {
        piece = boardPiece;
      } else {
        console.warn('Invalid board piece format:', boardPiece);
        return null;
      }

      return {
        id: `board-piece-${index}`,
        top: piece[0],
        bottom: piece[1]
      };
    }).filter(Boolean);
  }

  console.log('Placed Pieces:', placedPieces);

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
    console.log('Checking piece play:', piece, 'against ends:', { left, right });
    
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
      console.log('Calling play_move with:', { 
        game_id: gameState.id, 
        piece: pieceArray, 
        side 
      });

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

      if (data && typeof data === 'string') {
        if (data.includes('ERRO:')) {
          toast.error(data);
          return;
        }
        
        if (data.includes('venceu') || data.includes('Vitória')) {
          toast.success('🎉 Você venceu o jogo!');
        } else {
          toast.success('Jogada realizada com sucesso!');
        }
      } else {
        toast.success('Jogada realizada com sucesso!');
      }

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

  // Verificar se o jogo está ativo
  if (gameState.status !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <div className="text-center p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Aguardando início do jogo...</h2>
          <p className="text-purple-200">Status: {gameState.status}</p>
          <p className="text-purple-200 mt-2">Jogadores conectados: {playersState.length}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Debug info */}
        <div className="mb-4 p-2 bg-black/30 rounded text-white text-xs">
          <p>Jogo: {gameState.id}</p>
          <p>Status: {gameState.status}</p>
          <p>Turno: {gameState.current_player_turn}</p>
          <p>Jogadores: {playersState.length}</p>
          <p>Peças no tabuleiro: {placedPieces.length}</p>
        </div>

        {/* Área dos oponentes no topo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {otherPlayers.slice(0, 3).map(player => (
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
