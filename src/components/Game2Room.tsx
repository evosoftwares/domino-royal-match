import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData } from '@/types/game';
import { DominoPieceType } from '@/utils/dominoUtils';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';

interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}

// Interface local para ProcessedPlayer compatível
interface LocalProcessedPlayer {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
  position: number;
  originalData: PlayerData;
}

const Game2Room: React.FC<Game2RoomProps> = React.memo(({ gameData: initialGameData, players: initialPlayers }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

  // Debug dos dados recebidos
  console.log('Game2Room - gameData:', initialGameData);
  console.log('Game2Room - players:', initialPlayers);
  console.log('Game2Room - board_state:', initialGameData.board_state);

  useEffect(() => { setGameState(initialGameData); }, [initialGameData]);
  useEffect(() => { setPlayersState(initialPlayers); }, [initialPlayers]);

  useEffect(() => {
    if (gameState.status !== 'active') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev <= 1 ? 15 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState.status]);

  useEffect(() => { setTimeLeft(15); }, [gameState.current_player_turn]);

  // Função para processar peças da mão de forma robusta
  const processPieceFromHand = (piece: any, playerId: string, index: number): DominoPieceType | null => {
    console.log(`Processando peça da mão ${index} para jogador ${playerId}:`, piece);
    
    if (!piece) return null;
    
    // Formato {l: number, r: number}
    if (typeof piece === 'object' && 'l' in piece && 'r' in piece) {
      return {
        id: `${playerId}-piece-${index}`,
        top: piece.l,
        bottom: piece.r,
        originalFormat: piece
      };
    }
    
    // Formato [number, number]
    if (Array.isArray(piece) && piece.length === 2) {
      return {
        id: `${playerId}-piece-${index}`,
        top: piece[0],
        bottom: piece[1],
        originalFormat: { l: piece[0], r: piece[1] }
      };
    }
    
    // Formato já processado
    if (typeof piece === 'object' && 'top' in piece && 'bottom' in piece) {
      return {
        id: `${playerId}-piece-${index}`,
        top: piece.top,
        bottom: piece.bottom,
        originalFormat: { l: piece.top, r: piece.bottom }
      };
    }
    
    console.warn('Formato de peça não reconhecido:', piece);
    return null;
  };

  // Função para processar peças do tabuleiro de forma robusta
  const processBoardPiece = (boardPiece: any, index: number): DominoPieceType | null => {
    console.log(`Processando peça do tabuleiro ${index}:`, boardPiece);
    
    if (!boardPiece) return null;
    
    let pieceValues: [number, number] | null = null;
    
    // Formato {piece: [number, number]}
    if (boardPiece.piece && Array.isArray(boardPiece.piece) && boardPiece.piece.length === 2) {
      pieceValues = boardPiece.piece;
    }
    // Formato [number, number] direto
    else if (Array.isArray(boardPiece) && boardPiece.length === 2) {
      pieceValues = boardPiece;
    }
    // Formato {l: number, r: number}
    else if (typeof boardPiece === 'object' && typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
      pieceValues = [boardPiece.l, boardPiece.r];
    }
    // Formato já processado
    else if (typeof boardPiece === 'object' && typeof boardPiece.top === 'number' && typeof boardPiece.bottom === 'number') {
      pieceValues = [boardPiece.top, boardPiece.bottom];
    }
    
    if (!pieceValues) {
      console.warn('Não foi possível extrair valores da peça do tabuleiro:', boardPiece);
      return null;
    }
    
    return {
      id: `board-${index}`,
      top: pieceValues[0],
      bottom: pieceValues[1],
      originalFormat: { l: pieceValues[0], r: pieceValues[1] }
    };
  };

  const processedPlayers: LocalProcessedPlayer[] = playersState.map((player) => {
    const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) 
      ? player.hand.map((piece: any, index: number) => processPieceFromHand(piece, player.user_id, index))
          .filter((p): p is DominoPieceType => p !== null)
      : [];

    return {
      id: player.user_id,
      name: player.profiles?.full_name || `Jogador ${player.position}`,
      pieces,
      isCurrentPlayer: gameState.current_player_turn === player.user_id,
      position: player.position,
      originalData: player
    };
  });

  const currentUserPlayer = processedPlayers.find(p => p.id === user?.id);
  const opponents = processedPlayers.filter(p => p.id !== user?.id);

  // Processamento das peças do tabuleiro
  let boardPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    console.log('Processando peças do tabuleiro:', gameState.board_state.pieces);
    boardPieces = gameState.board_state.pieces
      .map((boardPiece: any, index: number) => processBoardPiece(boardPiece, index))
      .filter((p): p is DominoPieceType => p !== null);
  }

  console.log('Peças finais do tabuleiro:', boardPieces);

  const isFirstMove = boardPieces.length === 0;

  const getOpenEnds = useCallback(() => ({
    left: gameState.board_state?.leftEnd ?? null,
    right: gameState.board_state?.rightEnd ?? null
  }), [gameState.board_state]);

  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    const { left, right } = getOpenEnds();
    if (isFirstMove) return true;
    return [piece.top, piece.bottom].includes(left) || [piece.top, piece.bottom].includes(right);
  }, [isFirstMove, getOpenEnds]);

  const playPiece = useCallback(async (piece: DominoPieceType, placement?: 'left' | 'right') => {
    if (isProcessingMove || !user || gameState.current_player_turn !== user.id) return;

    setIsProcessingMove(true);
    toast.info("Processando jogada...");

    try {
      const { error } = await supabase.functions.invoke('play-move', {
        body: {
          gameId: gameState.id,
          userId: user.id,
          piece: [piece.top, piece.bottom],
          placement: placement || 'left'
        }
      });

      if (error) toast.error(`Erro: ${error.message || 'Jogada inválida.'}`);
      else toast.success('Jogada realizada!');
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    }

    setIsProcessingMove(false);
  }, [isProcessingMove, user, gameState.id, gameState.current_player_turn]);

  const handlePassTurn = useCallback(async () => {
    if (isProcessingMove || !user || gameState.current_player_turn !== user.id) return;

    setIsProcessingMove(true);
    toast.info("Passando a vez...");

    try {
      const { error } = await supabase.functions.invoke('pass-turn', {
        body: { gameId: gameState.id, userId: user.id }
      });

      if (error) toast.error(`Erro: ${error.message}`);
      else toast.info("Você passou a vez.");
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    }

    setIsProcessingMove(false);
  }, [isProcessingMove, user, gameState.id, gameState.current_player_turn]);

  if (!currentUserPlayer) return <div>Carregando seus dados...</div>;
  if (gameState.status === 'finished') {
    const winner = processedPlayers.find(p => p.id === (gameState as any).winner_id);
    return (
      <div className="text-center text-white text-2xl p-8">
        <h2>Fim de Jogo!</h2>
        <p>Vencedor: {winner?.name || 'Não determinado'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black p-4 flex flex-col">
      <div className="flex-shrink-0">
        <OpponentsList opponents={opponents as any} />
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        <GameBoard placedPieces={boardPieces} />
      </div>

      <div className="flex-shrink-0">
        <PlayerHand
          playerPieces={currentUserPlayer.pieces}
          onPiecePlay={playPiece}
          isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
          playerName={currentUserPlayer.name}
          timeLeft={timeLeft}
          onPass={handlePassTurn}
          isProcessingMove={isProcessingMove}
          canPiecePlay={canPiecePlay}
        />
      </div>
    </div>
  );
});

export default Game2Room;
