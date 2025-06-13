import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GameData, PlayerData, ProcessedPlayer, DominoPieceType } from '@/types/game';
import GameBoard from './GameBoard';
import OpponentsList from './OpponentsList';
import PlayerHand from './PlayerHand';
import GamePlayersHeader from './GamePlayersHeader';
import PlayerUI from './PlayerUI';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  standardizePiece, 
  toBackendFormat, 
  validateMove,
  extractBoardEnds,
  canPieceConnect 
} from '@/utils/pieceValidation';

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

  // OTIMIZAÇÃO: Estes useEffects são necessários para sincronizar o estado interno
  // com as props recebidas, mas o React.memo acima vai evitar re-renderizações desnecessárias
  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);

  // Lógica de auto-play unificada e eficiente (como discutimos)
  useEffect(() => {
    const isMyTurn = gameState.status === 'active' && gameState.current_player_turn === user?.id;

    if (isMyTurn) {
      const timerId = setTimeout(() => {
        toast.info('Tempo esgotado. Realizando jogada automática...');
        handleAutoPlayOnTimeout();
      }, 10000);

      return () => {
        clearTimeout(timerId);
      };
    }
  }, [gameState.current_player_turn, gameState.status, user?.id]);


  const processedPlayers: ProcessedPlayer[] = playersState.map((player): ProcessedPlayer => {
    const pieces: DominoPieceType[] = player.hand && Array.isArray(player.hand) 
      ? player.hand.map((piece: any, index: number): DominoPieceType | null => {
          if (piece && typeof piece === 'object' && 'l' in piece && 'r' in piece) {
            return {
              id: `${player.user_id}-piece-${index}`,
              top: piece.l,
              bottom: piece.r,
              originalFormat: piece
            };
          }
          return null;
        }).filter((p): p is DominoPieceType => p !== null)
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

  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state?.pieces && Array.isArray(gameState.board_state.pieces)) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => {
      let piece;
      if (boardPiece.piece && Array.isArray(boardPiece.piece)) {
        piece = boardPiece.piece;
      } else if (Array.isArray(boardPiece)) {
        piece = boardPiece;
      } else if (boardPiece && typeof boardPiece === 'object' && typeof boardPiece.l === 'number' && typeof boardPiece.r === 'number') {
        piece = [boardPiece.l, boardPiece.r];
      } else {
        return null;
      }

      return {
        id: `board-piece-${index}`,
        top: piece[0],
        bottom: piece[1]
      };
    }).filter((p): p is DominoPieceType => p !== null);
  }

  const isFirstMove = placedPieces.length === 0;

  // Função melhorada para verificar se uma peça pode ser jogada
  const canPiecePlay = useCallback((piece: DominoPieceType): boolean => {
    try {
      const standardPiece = standardizePiece(piece);
      const boardEnds = extractBoardEnds(gameState.board_state);
      const result = canPieceConnect(standardPiece, boardEnds);
      
      console.log('Verificação de jogabilidade:', {
        piece: standardPiece,
        boardEnds,
        canPlay: result
      });
      
      return result;
    } catch (error) {
      console.error('Erro ao verificar jogabilidade da peça:', error);
      return false;
    }
  }, [gameState.board_state]);

  // Função para obter as extremidades abertas
  const getOpenEnds = useCallback(() => {
    return extractBoardEnds(gameState.board_state);
  }, [gameState.board_state]);

  // Função melhorada para determinar o lado da jogada
  const determineSide = useCallback((piece: DominoPieceType): 'left' | 'right' | null => {
    const validation = validateMove(piece, gameState.board_state);
    return validation.side || null;
  }, [gameState.board_state]);

  // Função de auto-play melhorada
  const handleAutoPlayOnTimeout = useCallback(async () => {
    if (isProcessingMove) return;
    
    console.log('Executando auto-play por timeout...');
    setIsProcessingMove(true);
    
    try {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) {
        console.error('Erro no auto play:', error);
        toast.error(`Erro no jogo automático: ${error.message}`);
      } else {
        console.log('Auto play executado com sucesso');
        toast.success('Jogada automática realizada!');
      }
    } catch (e: any) {
      console.error('Erro inesperado no auto play:', e);
      toast.error('Erro inesperado no jogo automático.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);
  
  // Handlers de drag and drop
  const handlePieceDrag = (piece: DominoPieceType) => {
    console.log('Iniciando drag da peça:', piece);
    setCurrentDraggedPiece(piece);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('Drop detectado');
    
    if (currentDraggedPiece && currentUserPlayer?.isCurrentPlayer && !isProcessingMove) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  // Função principal para jogar uma peça (melhorada)
  const playPiece = useCallback(async (piece: DominoPieceType) => {
    console.log('Tentando jogar peça:', piece);
    
    if (isProcessingMove) {
      toast.error('Aguarde, processando jogada anterior.');
      return;
    }
    
    if (!user || gameState.current_player_turn !== user.id) {
      toast.error('Não é sua vez de jogar.');
      return;
    }

    // Validação melhorada da jogada
    const validation = validateMove(piece, gameState.board_state);
    
    if (!validation.isValid) {
      toast.error(validation.error || 'Jogada inválida');
      return;
    }

    setIsProcessingMove(true);
    
    try {
      // Preparar peça no formato do backend
      const pieceForRPC = piece.originalFormat || toBackendFormat(standardizePiece(piece));
      
      console.log('Enviando jogada:', {
        gameId: gameState.id,
        piece: pieceForRPC,
        side: validation.side
      });
      
      const { error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceForRPC,
        p_side: validation.side
      });
      
      if (error) {
        console.error('Erro ao jogar peça:', error);
        toast.error(`Erro ao jogar: ${error.message}`);
      } else {
        console.log('Jogada realizada com sucesso');
        toast.success('Jogada realizada com sucesso!');
      }
    } catch (e: any) {
      console.error('Erro inesperado ao jogar:', e);
      toast.error('Erro inesperado ao jogar.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [isProcessingMove, user, gameState.id, gameState.current_player_turn]);

  // Função para passar a vez
  const handlePassTurn = useCallback(async () => {
    if (isProcessingMove) return;
    
    console.log('Passando a vez...');
    setIsProcessingMove(true);
    
    try {
      const { error } = await supabase.rpc('pass_turn', {
        p_game_id: gameState.id
      });
      
      if (error) {
        console.error('Erro ao passar a vez:', error);
        toast.error(`Erro ao passar a vez: ${error.message}`);
      } else {
        console.log('Vez passada com sucesso');
        toast.info('Você passou a vez.');
      }
    } catch (e: any) {
      console.error('Erro inesperado ao passar a vez:', e);
      toast.error('Erro inesperado ao passar a vez.');
    } finally {
      setIsProcessingMove(false);
    }
  }, [gameState.id, isProcessingMove]);

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black overflow-hidden">
      <GamePlayersHeader gameId={gameState.id} />
        {isMobile ? (
          <div className="h-screen flex relative">
            {/* Layout mobile permanece igual */}
          </div>
        ) : (
          <div className="min-h-screen flex flex-col">
            <div className="flex-shrink-0 p-4">
              <OpponentsList opponents={opponents} />
            </div>
            <div className="flex-1 flex items-center justify-center p-4 px-0 py-[56px] my-0">
              <GameBoard 
                placedPieces={placedPieces} 
                onDrop={handleDrop} 
                onDragOver={handleDragOver} 
                className="w-full max-w-4xl" 
              />
            </div>
            <div className="flex-shrink-0 p-4 flex items-center justify-between">
              <div className="flex-1">
                {currentUserPlayer && (
                  <PlayerHand 
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
            </div>
          </div>
        )}
    </div>
  );
};

export default React.memo(Game2Room);
