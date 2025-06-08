import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import { useIsMobile } from '@/hooks/use-mobile';

interface Game2RoomProps {
  gameData: GameData;
  players: PlayerData[];
}

const Game2Room: React.FC<Game2RoomProps> = ({
  gameData: initialGameData,
  players: initialPlayers,
}) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [gameState, setGameState] = useState(initialGameData);
  const [playersState, setPlayersState] = useState(initialPlayers);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // <<< REMOVIDO >>> Estados desnecessários para a nova lógica.
  // const [timeLeft, setTimeLeft] = useState(15);
  // const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  // <<< MUDANÇA >>> Lógica de auto-play unificada e eficiente.
  // Este useEffect substitui os dois useEffects de timer anteriores.
  useEffect(() => {
    // Apenas ativa o timer se o jogo estiver ativo e for a vez do jogador atual.
    const isMyTurn = gameState.status === 'active' && gameState.current_player_turn === user?.id;

    if (isMyTurn) {
      console.log('Sua vez. Cronômetro de 10s para jogada automática iniciado.');
      
      const timerId = setTimeout(() => {
        // Se o tempo esgotar, chama a função de auto-play via RPC.
        // A verificação !isProcessingMove é feita dentro da função chamada.
        toast.info('Tempo esgotado. Realizando jogada automática...');
        handleAutoPlayOnTimeout();
      }, 10000); // Executa após 10 segundos de inatividade.

      // Função de limpeza: ESSENCIAL!
      // Cancela o timer se o jogador fizer uma jogada, se o turno mudar, ou se o componente for desmontado.
      return () => {
        clearTimeout(timerId);
        console.log('Cronômetro de jogada automática cancelado.');
      };
    }
  // A dependência agora é apenas no turno do jogador e no status do jogo.
  }, [gameState.current_player_turn, gameState.status, user?.id]);


  // <<< REMOVIDO >>> O useEffect que controlava o "timeLeft" foi removido.
  // <<< REMOVIDO >>> O useEffect que controlava o "autoPlayEnabled" foi removido.

  const processedPlayers: ProcessedPlayer[] = playersState.map(/* ...código existente sem alterações... */);
  const currentUserPlayer = processedPlayers.find(p => p.id === user?.id);
  const opponents = processedPlayers.filter(p => p.id !== user?.id);
  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    // ...código existente sem alterações...
  }
  const isFirstMove = placedPieces.length === 0;
  const getOpenEnds = useCallback(/* ...código existente sem alterações... */);
  const canPiecePlay = useCallback(/* ...código existente sem alterações... */);
  const determineSide = useCallback(/* ...código existente sem alterações... */);


  // <<< MUDANÇA >>> Função renomeada para maior clareza. Esta é a ÚNICA função de auto-play agora.
  const handleAutoPlayOnTimeout = useCallback(async () => {
    if (isProcessingMove) return;

    setIsProcessingMove(true);
    try {
      // Chama a função RPC do Supabase que contém a lógica do jogo.
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });

      if (error) {
        console.error('Erro na jogada automática por tempo:', error.message);
        toast.error(`Erro no auto play: ${error.message}`);
      } else {
        toast.success('Jogada automática realizada pelo sistema!');
      }
    } catch (e: any) {
      console.error('Erro inesperado no auto play por tempo:', e);
      toast.error('Erro inesperado no auto play.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);
  

  const handlePieceDrag = (piece: DominoPieceType) => { /* ...código existente... */ };
  const handleDragOver = (e: React.DragEvent) => { /* ...código existente... */ };
  const handleDrop = (e: React.DragEvent) => { /* ...código existente... */ };
  const playPiece = useCallback(async (piece: DominoPieceType) => { /* ...código existente... */ });
  const handlePassTurn = useCallback(async () => { /* ...código existente... */ });

  // <<< REMOVIDO >>> Funções de auto-play antigas e desnecessárias.
  // const handleForceAutoPlay = useCallback(() => { ... });
  // const handleManualAutoPlay = () => { ... };
  // const toggleAutoPlay = () => { ... };


  if (gameState.status !== 'active') {
    // ...código JSX existente sem alterações...
  }

  return (
    <div className="min-h-screen ...">
      <GamePlayersHeader gameId={gameState.id} />

      {isMobile ? (
        <div className="h-screen flex relative">
          {/* ... Estrutura JSX para mobile ... */}

          {/* <<< REMOVIDO >>> Controles de auto play removidos da UI */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Prêmio R${gameState.prize_amount?.toFixed(2) || '0,00'}
            </div>
            {/* O botão de toggle foi completamente removido daqui */}
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          {/* ... Estrutura JSX para desktop ... */}
          
          <div className="flex-shrink-0 p-4 flex items-center justify-between">
            <div className="flex-1">
              {currentUserPlayer && (
                <PlayerHand
                  // <<< MUDANÇA >>> Removendo a prop `timeLeft` que não existe mais.
                  //<<< A prop `onAutoPlay` pode ser removida ou ligada a outra função se houver um botão manual
                  playerPieces={currentUserPlayer.pieces}
                  onPieceDrag={handlePieceDrag}
                  onPiecePlay={playPiece}
                  isCurrentPlayer={currentUserPlayer.isCurrentPlayer}
                  playerName={currentUserPlayer.name}
                  isProcessingMove={isProcessingMove}
                  canPiecePlay={canPiecePlay}
                />
              )}
            </div>
            
            {/* <<< REMOVIDO >>> O botão de toggle foi completamente removido daqui */}
          </div>
        </div>
      )}
    </div>
  );
};

export default Game2Room;