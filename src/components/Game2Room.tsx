import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';

interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const Game2Room: React.FC<Game2RoomProps> = React.memo(({ gameData: initialGameData, players: initialPlayers }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

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

  const processedPlayers: ProcessedPlayer[] = playersState.map((player) => ({
    id: player.user_id,
    name: player.profiles?.full_name || `Jogador ${player.position}`,
    pieces: (player.hand || []).map((p: [number, number], i: number) => ({
      id: `${player.user_id}-${i}`,
      top: p[0],
      bottom: p[1],
      originalFormat: p
    })),
    isCurrentPlayer: gameState.current_player_turn === player.user_id,
    position: player.position,
    originalData: player
  }));

  const currentUserPlayer = processedPlayers.find(p => p.id === user?.id);
  const opponents = processedPlayers.filter(p => p.id !== user?.id);

  const boardPieces: DominoPieceType[] = (gameState.board_state?.pieces || []).map((p, i: number) => ({
    id: `board-${i}`,
    top: p.piece[0],
    bottom: p.piece[1],
    orientation: p.orientation
  }));

  const isFirstMove = boardPieces.length === 0;

  const getOpenEnds = useCallback(() => ({
    left: gameState.board_state?.left_end ?? null,
    right: gameState.board_state?.right_end ?? null
  }), [gameState.board_state]);

  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    const { left, right } = getOpenEnds();
    if (isFirstMove) return true;
    return [piece.top, piece.bottom].includes(left) || [piece.top, piece.bottom].includes(right);
  }, [isFirstMove, getOpenEnds]);

  const playPiece = useCallback(async (piece: DominoPieceType, placement: 'left' | 'right') => {
    if (isProcessingMove || !user || gameState.current_player_turn !== user.id) return;

    setIsProcessingMove(true);
    toast.info("Processando jogada...");

    try {
      const { error } = await supabase.functions.invoke('play-move', {
        body: {
          gameId: gameState.id,
          userId: user.id,
          piece: [piece.top, piece.bottom],
          placement
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
    const winner = processedPlayers.find(p => p.id === gameState.winner_id);
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
        <OpponentsList opponents={opponents} />
      </div>

      <div className="flex-1 flex items-center justify-center py-4">
        <GameBoard placedPieces={boardPieces} />
      </div>

      <div className="flex-shrink-0">
        <PlayerHand
          playerPieces={currentUserPlayer.pieces}
          onPiecePlay={(piece, placement) => playPiece(piece, placement!)}
          isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
          playerName={currentUserPlayer.name}
          timeLeft={timeLeft}
          onPass={handlePassTurn}
          isProcessingMove={isProcessingMove}
          canPiecePlay={canPiecePlay}
          boardEnds={getOpenEnds()}
        />
      </div>
    </div>
  );
});

export default Game2Room;
