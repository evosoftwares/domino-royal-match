
import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import { DominoPieceType } from '@/utils/dominoUtils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Interfaces importadas ou definidas no mesmo arquivo que Game.tsx
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
  hand: any; // JSON array no formato [[valor1, valor2], [valor1, valor2], ...]
  status: string;
  profiles: PlayerProfile;
}

// Interface para o formato de jogador usado internamente pelo GameRoom
interface Player {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
}

// --- Defina as props que o componente espera receber ---
interface GameRoomProps {
  gameData: GameData;
  players: PlayerData[];
}

// --- NOVO COMPONENTE PARA O CARD DO OPONENTE (sem alterações) ---
const OpponentCard: React.FC<{ player: Player }> = ({ player }) => {
  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border border-purple-600/20">
      <div className="flex items-center justify-between h-full">
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

// --- Altere a declaração do componente para aceitar as props ---
const GameRoom: React.FC<GameRoomProps> = ({ gameData, players }) => {
  const { user } = useAuth();

  // Estados que ainda são de responsabilidade deste componente
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // --- Os dados agora são derivados diretamente das props, não mais do estado interno ---
  const gameStarted = gameData.status === 'active' || gameData.status === 'starting';

  // Converter os dados dos jogadores do Supabase para o formato interno
  const formattedPlayers: Player[] = players.map(player => {
    let pieces: DominoPieceType[] = [];
    
    // Converter o campo hand do Supabase (array JSON) para DominoPieceType
    if (player.hand && Array.isArray(player.hand)) {
      pieces = player.hand.map((piece: [number, number], index: number) => ({
        id: `${player.user_id}-piece-${index}`,
        top: piece[0],
        bottom: piece[1]
      }));
    }
    
    return {
      id: player.user_id,
      name: player.profiles?.full_name || 'Jogador',
      pieces,
      isCurrentPlayer: gameData.current_player_turn === player.user_id,
      position: player.position
    };
  });

  // Converter board_state do Supabase para peças colocadas
  let placedPieces: DominoPieceType[] = [];
  if (gameData.board_state && typeof gameData.board_state === 'object' && (gameData.board_state as any).pieces) {
    const boardState = gameData.board_state as { pieces: any[]; };
    placedPieces = boardState.pieces.map((boardPiece: any, index: number) => ({
      id: `board-piece-${index}`,
      top: boardPiece.piece[0],
      bottom: boardPiece.piece[1]
    }));
  }

  // Verificar se é o primeiro movimento do jogo
  const isFirstMove = placedPieces.length === 0;
  
  // Obter as extremidades abertas do tabuleiro
  const getOpenEnds = () => {
    if (isFirstMove) return { left: null, right: null };
    
    const boardState = gameData.board_state;
    return {
      left: boardState?.left_end || null,
      right: boardState?.right_end || null
    };
  };

  // Verificar se uma peça pode ser jogada
  const canPiecePlay = (piece: DominoPieceType): boolean => {
    if (isFirstMove) return true;
    
    const { left, right } = getOpenEnds();
    return piece.top === left || piece.bottom === left || 
           piece.top === right || piece.bottom === right;
  };

  // Determinar em qual lado a peça deve ser jogada
  const determineSide = (piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left'; // Para o primeiro movimento, sempre lado esquerdo
    
    const { left, right } = getOpenEnds();
    
    if (piece.top === left || piece.bottom === left) return 'left';
    if (piece.top === right || piece.bottom === right) return 'right';
    
    return null;
  };
  
  // Timer (lógica pode ser mantida ou ajustada conforme necessário)
  useEffect(() => {
    if (!gameStarted) return;
    const timer = setInterval(() => {
        // Lógica de contagem regressiva
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStarted, gameData.current_player_turn]);

  const handlePieceDrag = (piece: DominoPieceType) => {
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece) {
      handlePiecePlayed(currentDraggedPiece);
    }
  };
  
  // Função principal para jogar uma peça
  const handlePiecePlayed = async (piece: DominoPieceType) => {
    if (isProcessingMove) {
      toast.error('Aguarde a jogada anterior ser processada');
      return;
    }

    if (!user || gameData.current_player_turn !== user.id) {
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
      // Converter a peça para o formato JSON esperado pelo Supabase
      const pieceJson = [piece.top, piece.bottom];

      console.log('Enviando jogada:', {
        gameId: gameData.id,
        piece: pieceJson,
        side
      });

      // Chamar a função RPC do Supabase
      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameData.id,
        p_piece: pieceJson,
        p_side: side
      });

      if (error) {
        console.error('Erro na RPC play_move:', error);
        toast.error(`Erro ao jogar peça: ${error.message}`);
        return;
      }

      console.log('Resultado da jogada:', data);

      if (data && data.includes('ERRO:')) {
        toast.error(data);
        return;
      }

      // Sucesso
      if (data && data.includes('venceu')) {
        toast.success('🎉 Você venceu o jogo!');
      } else {
        toast.success('Jogada realizada com sucesso!');
      }

      // Limpar o estado de drag
      setCurrentDraggedPiece(null);

    } catch (error) {
      console.error('Erro inesperado ao jogar peça:', error);
      toast.error('Erro inesperado ao jogar peça');
    } finally {
      setIsProcessingMove(false);
    }
  };
  
  const handleAutoPlay = async () => {
    if (isProcessingMove) {
      toast.error('Aguarde a jogada anterior ser processada');
      return;
    }

    if (!user || gameData.current_player_turn !== user.id) {
      toast.error('Não é sua vez de jogar');
      return;
    }

    const userPlayer = formattedPlayers.find(p => p.id === user.id);
    if (!userPlayer) {
      toast.error('Jogador não encontrado');
      return;
    }

    // Encontrar a primeira peça que pode ser jogada
    const playablePiece = userPlayer.pieces.find(piece => canPiecePlay(piece));
    
    if (!playablePiece) {
      toast.error('Nenhuma peça pode ser jogada');
      return;
    }

    console.log('Auto play: jogando peça', playablePiece);
    await handlePiecePlayed(playablePiece);
  };

  // Filtra os jogadores para separar o usuário atual dos oponentes
  const otherPlayers = formattedPlayers.filter(p => p.id !== user?.id);
  const userPlayer = formattedPlayers.find(p => p.id === user?.id);

  if (!gameStarted) {
    return <div className="text-center p-8 text-white">Aguardando o início do jogo...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherPlayers.map(player => (
          <OpponentCard key={player.id} player={player} />
        ))}
      </div>

      <GameBoard
        placedPieces={placedPieces}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />

      {userPlayer && (
        <PlayerArea
          playerPieces={userPlayer.pieces}
          onPieceDrag={handlePieceDrag}
          isCurrentPlayer={userPlayer.isCurrentPlayer}
          playerName={userPlayer.name}
          timeLeft={timeLeft}
          onAutoPlay={handleAutoPlay}
          isProcessingMove={isProcessingMove}
          canPiecePlay={canPiecePlay}
        />
      )}
    </div>
  );
};

export default GameRoom;
