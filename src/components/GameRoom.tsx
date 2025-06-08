
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DominoPieceType } from '@/utils/dominoUtils';
import DominoPiece from './DominoPiece';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Interfaces para tipos de dados
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

// Componente para mostrar oponentes no topo
const OpponentCard: React.FC<{ 
  player: PlayerData; 
  isCurrentPlayer: boolean;
  pieceCount: number;
}> = ({ player, isCurrentPlayer, pieceCount }) => {
  return (
    <div className={cn(
      "bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border transition-all duration-300",
      isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/20"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full transition-colors",
            isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
          )} />
          <div>
            <span className={cn(
              "text-sm font-medium",
              isCurrentPlayer ? "text-yellow-400" : "text-purple-200"
            )}>
              {player.profiles?.full_name || 'Jogador'}
            </span>
            {isCurrentPlayer && (
              <div className="text-xs text-green-400 font-semibold">Jogando...</div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: pieceCount }).map((_, index) => (
            <div
              key={index}
              className="w-2 h-4 bg-white/70 rounded-sm border border-black/20 shadow-sm"
              title={`Peça ${index + 1}`}
            />
          ))}
          <span className="ml-2 text-xs text-purple-300">{pieceCount}</span>
        </div>
      </div>
    </div>
  );
};

// Componente principal do GameRoom
const GameRoom: React.FC<GameRoomProps> = ({ gameData, players }) => {
  const { user } = useAuth();
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [gameState, setGameState] = useState(gameData);
  const [playersState, setPlayersState] = useState(players);
  const boardRef = useRef<HTMLDivElement>(null);

  // Sincronização em tempo real
  useEffect(() => {
    if (!gameData.id) return;

    const gameChannel = supabase.channel(`game-${gameData.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameData.id}`
      }, payload => {
        console.log('Game updated:', payload);
        if (payload.new) {
          setGameState(payload.new as GameData);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameData.id}`
      }, payload => {
        console.log('Players updated:', payload);
        // Recarregar dados dos jogadores
        fetchPlayers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameData.id]);

  // Função para buscar jogadores atualizados
  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('game_players')
        .select(`
          *,
          profiles!game_players_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('game_id', gameData.id)
        .order('position');

      if (error) {
        console.error('Erro ao buscar jogadores:', error);
        return;
      }

      setPlayersState(data || []);
    } catch (error) {
      console.error('Erro inesperado ao buscar jogadores:', error);
    }
  };

  // Timer de turno
  useEffect(() => {
    if (gameState.status !== 'active') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto play quando o tempo acabar
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

  // Resetar timer quando muda o turno
  useEffect(() => {
    setTimeLeft(30);
  }, [gameState.current_player_turn]);

  // Converter dados para formato interno
  const formattedPlayers = playersState.map(player => {
    let pieces: DominoPieceType[] = [];
    
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
      isCurrentPlayer: gameState.current_player_turn === player.user_id,
      position: player.position,
      originalData: player
    };
  });

  // Peças no tabuleiro
  let placedPieces: DominoPieceType[] = [];
  if (gameState.board_state && typeof gameState.board_state === 'object' && gameState.board_state.pieces) {
    placedPieces = gameState.board_state.pieces.map((boardPiece: any, index: number) => ({
      id: `board-piece-${index}`,
      top: boardPiece.piece[0],
      bottom: boardPiece.piece[1]
    }));
  }

  const isFirstMove = placedPieces.length === 0;
  const userPlayer = formattedPlayers.find(p => p.id === user?.id);
  const otherPlayers = formattedPlayers.filter(p => p.id !== user?.id);

  // Verificar extremidades abertas
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
    return piece.top === left || piece.bottom === left || 
           piece.top === right || piece.bottom === right;
  };

  // Determinar lado da jogada
  const determineSide = (piece: DominoPieceType): 'left' | 'right' | null => {
    if (isFirstMove) return 'left';
    
    const { left, right } = getOpenEnds();
    
    if (piece.top === left || piece.bottom === left) return 'left';
    if (piece.top === right || piece.bottom === right) return 'right';
    
    return null;
  };

  // Handlers de drag and drop
  const handleDragStart = (piece: DominoPieceType) => (e: React.DragEvent) => {
    if (!userPlayer?.isCurrentPlayer || isProcessingMove) {
      e.preventDefault();
      return;
    }

    if (!canPiecePlay(piece)) {
      e.preventDefault();
      toast.error('Esta peça não pode ser jogada');
      return;
    }

    setCurrentDraggedPiece(piece);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', piece.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece && userPlayer?.isCurrentPlayer) {
      playPiece(currentDraggedPiece);
    }
    setCurrentDraggedPiece(null);
  };

  const handleDragEnd = () => {
    setCurrentDraggedPiece(null);
  };

  // Jogar peça
  const playPiece = async (piece: DominoPieceType) => {
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
      const pieceJson = [piece.top, piece.bottom];

      console.log('Jogando peça:', { piece: pieceJson, side });

      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceJson,
        p_side: side
      });

      if (error) {
        console.error('Erro na jogada:', error);
        toast.error(`Erro ao jogar peça: ${error.message}`);
        return;
      }

      if (data && data.includes('ERRO:')) {
        toast.error(data);
        return;
      }

      if (data && data.includes('venceu')) {
        toast.success('🎉 Você venceu o jogo!');
      } else {
        toast.success('Jogada realizada com sucesso!');
      }

    } catch (error) {
      console.error('Erro inesperado:', error);
      toast.error('Erro inesperado ao jogar peça');
    } finally {
      setIsProcessingMove(false);
    }
  };

  // Auto play
  const handleAutoPlay = async () => {
    if (!userPlayer || !userPlayer.isCurrentPlayer) return;

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
            <OpponentCard
              key={player.id}
              player={player.originalData}
              isCurrentPlayer={player.isCurrentPlayer}
              pieceCount={player.pieces.length}
            />
          ))}
        </div>

        {/* Mesa de jogo centralizada */}
        <div className="flex justify-center mb-6">
          <div 
            ref={boardRef}
            className={cn(
              "w-full max-w-4xl min-h-[300px] bg-gradient-to-br from-green-800/30 to-green-900/30 rounded-3xl border-4 border-green-600/30 backdrop-blur-sm p-8",
              "flex items-center justify-center"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {placedPieces.length === 0 ? (
              <div className="text-center text-green-200">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-xl font-semibold">Arraste a primeira peça aqui</p>
                <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 max-w-full overflow-auto">
                {placedPieces.map((piece, index) => (
                  <div key={`${piece.id}-${index}`} className="relative">
                    <DominoPiece
                      topValue={piece.top}
                      bottomValue={piece.bottom}
                      isPlayable={false}
                      className="shadow-2xl transform rotate-90"
                    />
                    {index === 0 && (
                      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                    {index === placedPieces.length - 1 && (
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Área do jogador atual */}
        {userPlayer && (
          <div className={cn(
            "bg-gradient-to-r from-purple-900/50 to-black/50 rounded-2xl p-6 border-2 transition-all duration-300",
            userPlayer.isCurrentPlayer ? "border-yellow-400 shadow-lg shadow-yellow-400/20" : "border-purple-600/30"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full",
                  userPlayer.isCurrentPlayer ? "bg-yellow-400 animate-pulse" : "bg-gray-500"
                )} />
                <h3 className={cn(
                  "text-lg font-semibold",
                  userPlayer.isCurrentPlayer ? "text-yellow-400" : "text-purple-200"
                )}>
                  {userPlayer.name} {userPlayer.isCurrentPlayer && "(Sua vez)"}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {userPlayer.isCurrentPlayer && (
                  <>
                    <Button 
                      onClick={handleAutoPlay}
                      disabled={isProcessingMove}
                      size="sm"
                      variant="outline"
                      className="bg-yellow-400/10 border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/20"
                    >
                      {isProcessingMove ? 'Processando...' : 'Auto Play'}
                    </Button>
                    
                    <div className={cn(
                      "text-sm font-mono px-3 py-1 rounded-full",
                      timeLeft <= 3 ? "bg-red-500 text-white animate-pulse" : "bg-yellow-400 text-black"
                    )}>
                      {timeLeft}s
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Peças do jogador */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {userPlayer.pieces.map((piece) => {
                const isPiecePlayable = canPiecePlay(piece);
                
                return (
                  <div key={piece.id} className="flex-shrink-0">
                    <DominoPiece
                      topValue={piece.top}
                      bottomValue={piece.bottom}
                      isDragging={currentDraggedPiece?.id === piece.id}
                      isPlayable={userPlayer.isCurrentPlayer && isPiecePlayable && !isProcessingMove}
                      onDragStart={handleDragStart(piece)}
                      onDragEnd={handleDragEnd}
                      onClick={() => userPlayer.isCurrentPlayer && isPiecePlayable && playPiece(piece)}
                      className={cn(
                        "transition-all duration-200",
                        !userPlayer.isCurrentPlayer && "grayscale",
                        userPlayer.isCurrentPlayer && !isPiecePlayable && "opacity-50 cursor-not-allowed",
                        userPlayer.isCurrentPlayer && isPiecePlayable && "hover:ring-2 hover:ring-yellow-400 cursor-pointer"
                      )}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-purple-300">
                {userPlayer.pieces.length} peças restantes
              </div>
              
              {userPlayer.isCurrentPlayer && (
                <div className="text-xs text-yellow-400">
                  {userPlayer.pieces.filter(piece => canPiecePlay(piece)).length} peças jogáveis
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameRoom;
