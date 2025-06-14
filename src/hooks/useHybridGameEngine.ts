
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';
import { validateMove, standardizePiece, toBackendFormat, extractBoardEnds } from '@/utils/pieceValidation';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseHybridGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

interface PendingMove {
  id: string;
  type: 'play' | 'pass';
  piece?: DominoPieceType;
  timestamp: number;
  retryCount: number;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;

export const useHybridGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseHybridGameEngineProps) => {
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  
  // Refs para debounce e heartbeat
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);

  const getNextPlayerId = useCallback(() => {
    const sortedPlayers = [...playersState].sort((a, b) => a.position - b.position);
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
    return sortedPlayers[nextPlayerIndex]?.user_id;
  }, [playersState, gameState.current_player_turn]);

  // Heartbeat para detectar desconexões
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;
      
      if (timeSinceLastHeartbeat > 30000) { // 30 segundos sem heartbeat
        setConnectionStatus('disconnected');
        console.warn('Conexão perdida - sem heartbeat há', timeSinceLastHeartbeat, 'ms');
      } else if (timeSinceLastHeartbeat > 15000) { // 15 segundos - aviso
        setConnectionStatus('reconnecting');
      } else {
        setConnectionStatus('connected');
      }
    }, 5000); // Verifica a cada 5 segundos
  }, []);

  // Debounced update handler
  const debouncedStateUpdate = useCallback((updateFn: () => void, delay: number = 500) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateFn();
    }, delay);
  }, []);

  // Centralizar toda sincronização real-time aqui
  useEffect(() => {
    if (!gameState.id) return;

    // Limpar canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    try {
      const gameChannel = supabase.channel(`hybrid-game:${gameState.id}`);
      channelRef.current = gameChannel;

      // Subscription para mudanças no jogo
      gameChannel.on<GameData>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameState.id}` },
        (payload) => {
          console.log('Game state updated via realtime:', payload.new);
          lastHeartbeatRef.current = Date.now();
          
          debouncedStateUpdate(() => {
            setGameState(payload.new as GameData);
            toast.info("Estado do jogo atualizado", { duration: 2000 });
          });
        }
      );

      // Subscription para mudanças nos jogadores
      gameChannel.on<PlayerData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameState.id}` },
        async (payload) => {
          try {
            console.log('Player state updated via realtime:', payload);
            lastHeartbeatRef.current = Date.now();

            debouncedStateUpdate(() => {
              if (payload.eventType === 'UPDATE') {
                setPlayersState(currentPlayers => 
                  currentPlayers.map(p => p.id === payload.new.id ? payload.new as PlayerData : p)
                );
              }
            });
          } catch (error) {
            console.error('Erro ao processar atualização de jogador:', error);
          }
        }
      );

      // Subscribe com status tracking
      gameChannel.subscribe((status) => {
        console.log('Canal híbrido status:', status);
        lastHeartbeatRef.current = Date.now();
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          startHeartbeat();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          console.error('Erro no canal realtime híbrido');
          toast.error('Erro de conexão em tempo real');
        }
      });

    } catch (error) {
      console.error('Erro ao configurar realtime híbrido:', error);
      setConnectionStatus('disconnected');
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [gameState.id, debouncedStateUpdate, startHeartbeat]);

  // Aplicar mudança local (optimistic update)
  const applyLocalMove = useCallback((piece: DominoPieceType) => {
    const validation = validateMove(piece, gameState.board_state);
    if (!validation.isValid || !validation.side) {
      return false;
    }

    const standardPieceToPlay = standardizePiece(piece);
    
    // 1. Update Player's Hand
    const updatedPlayers = playersState.map(p => {
      if (p.user_id === userId) {
        let found = false;
        const newHand = p.hand.filter((p_piece: any) => {
          if (found) return true;
          const standard = standardizePiece(p_piece);
          const isMatch = (standard.left === standardPieceToPlay.left && standard.right === standardPieceToPlay.right) ||
                          (standard.left === standardPieceToPlay.right && standard.right === standardPieceToPlay.left);
          if (isMatch) {
            found = true;
            return false;
          }
          return true;
        });
        return { ...p, hand: newHand };
      }
      return p;
    });
    setPlayersState(updatedPlayers);

    // 2. Update Board State
    const currentBoardPieces = gameState.board_state?.pieces || [];
    const boardEnds = extractBoardEnds(gameState.board_state);
    const side = validation.side;

    let newPieces = [...currentBoardPieces];
    let newLeftEnd = boardEnds.left;
    let newRightEnd = boardEnds.right;

    if (newPieces.length === 0) {
      newPieces.push({ piece: toBackendFormat(standardPieceToPlay), rotation: 0 });
      newLeftEnd = standardPieceToPlay.left;
      newRightEnd = standardPieceToPlay.right;
    } else if (side === 'left') {
      let pieceForBoard;
      if (standardPieceToPlay.right === boardEnds.left) {
        newLeftEnd = standardPieceToPlay.left;
        pieceForBoard = { l: standardPieceToPlay.left, r: standardPieceToPlay.right };
      } else {
        newLeftEnd = standardPieceToPlay.right;
        pieceForBoard = { l: standardPieceToPlay.right, r: standardPieceToPlay.left };
      }
      newPieces.unshift({ piece: pieceForBoard, rotation: 0 });
    } else {
      let pieceForBoard;
      if (standardPieceToPlay.left === boardEnds.right) {
        newRightEnd = standardPieceToPlay.right;
        pieceForBoard = { l: standardPieceToPlay.left, r: standardPieceToPlay.right };
      } else {
        newRightEnd = standardPieceToPlay.left;
        pieceForBoard = { l: standardPieceToPlay.right, r: standardPieceToPlay.left };
      }
      newPieces.push({ piece: pieceForBoard, rotation: 0 });
    }

    const newBoardState = {
      pieces: newPieces,
      left_end: newLeftEnd,
      right_end: newRightEnd,
    };

    // 3. Update Game State (turn)
    const nextPlayerId = getNextPlayerId();
    setGameState(prev => ({
      ...prev,
      board_state: newBoardState,
      current_player_turn: nextPlayerId,
    }));

    return true;
  }, [gameState, playersState, userId, getNextPlayerId]);

  // Aplicar passe local
  const applyLocalPass = useCallback(() => {
    const nextPlayerId = getNextPlayerId();
    setGameState(prev => ({
      ...prev,
      current_player_turn: nextPlayerId,
    }));
  }, [getNextPlayerId]);

  // Sincronizar com servidor
  const syncWithServer = useCallback(async (move: PendingMove) => {
    try {
      if (move.type === 'play' && move.piece) {
        const pieceForRPC = move.piece.originalFormat || toBackendFormat(standardizePiece(move.piece));
        const validation = validateMove(move.piece, gameState.board_state);
        
        const { error } = await supabase.rpc('play_move', {
          p_game_id: gameState.id,
          p_piece: pieceForRPC,
          p_side: validation.side
        });

        if (error) {
          console.error('Erro ao sincronizar jogada:', error);
          throw error;
        }
      } else if (move.type === 'pass') {
        const { error } = await supabase.rpc('pass_turn', {
          p_game_id: gameState.id
        });

        if (error) {
          console.error('Erro ao sincronizar passe:', error);
          throw error;
        }
      }

      // Remove movimento da fila de pendentes
      setPendingMoves(prev => prev.filter(m => m.id !== move.id));
      setRetryCount(0);
      return true;
    } catch (error) {
      console.error('Erro na sincronização:', error);
      
      // Incrementar retry count
      setPendingMoves(prev => prev.map(m => 
        m.id === move.id 
          ? { ...m, retryCount: m.retryCount + 1 }
          : m
      ));
      
      return false;
    }
  }, [gameState.id, gameState.board_state]);

  // Processar fila de movimentos pendentes
  useEffect(() => {
    const processPendingMoves = async () => {
      if (pendingMoves.length === 0 || isProcessingMove) return;

      const moveToProcess = pendingMoves[0];
      
      // Limitar tentativas
      if (moveToProcess.retryCount >= 3) {
        setPendingMoves(prev => prev.filter(m => m.id !== moveToProcess.id));
        toast.error('Falha ao sincronizar movimento após 3 tentativas');
        setRetryCount(0);
        return;
      }

      setRetryCount(moveToProcess.retryCount + 1);
      await syncWithServer(moveToProcess);
    };

    const timeoutId = setTimeout(processPendingMoves, 100);
    return () => clearTimeout(timeoutId);
  }, [pendingMoves, isProcessingMove, syncWithServer]);

  const playPiece = useCallback(async (piece: DominoPieceType) => {
    if (isProcessingMove) {
      toast.error("Aguarde, processando jogada anterior.");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de jogar.");
      return false;
    }

    setIsProcessingMove(true);
    setCurrentAction('playing');

    try {
      // 1. Aplicar mudança local imediatamente (optimistic update)
      const localSuccess = applyLocalMove(piece);
      
      if (!localSuccess) {
        toast.error('Jogada inválida');
        return false;
      }

      // 2. Adicionar à fila de sincronização
      const moveId = `${Date.now()}-${Math.random()}`;
      setPendingMoves(prev => [...prev, {
        id: moveId,
        type: 'play',
        piece,
        timestamp: Date.now(),
        retryCount: 0
      }]);

      toast.success('Peça jogada!');
      return true;
    } catch (error) {
      console.error('Erro ao jogar peça:', error);
      toast.error('Erro ao jogar peça');
      return false;
    } finally {
      setIsProcessingMove(false);
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalMove]);

  const passTurn = useCallback(async () => {
    if (isProcessingMove) {
      toast.error("Aguarde, processando ação anterior.");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de passar.");
      return false;
    }

    setIsProcessingMove(true);
    setCurrentAction('passing');

    try {
      // 1. Aplicar passe local
      applyLocalPass();

      // 2. Adicionar à fila de sincronização
      const moveId = `${Date.now()}-${Math.random()}`;
      setPendingMoves(prev => [...prev, {
        id: moveId,
        type: 'pass',
        timestamp: Date.now(),
        retryCount: 0
      }]);

      toast.info('Vez passada!');
      return true;
    } catch (error) {
      console.error('Erro ao passar a vez:', error);
      toast.error('Erro ao passar a vez');
      return false;
    } finally {
      setIsProcessingMove(false);
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalPass]);

  const playAutomatic = useCallback(async () => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    
    try {
      const { error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) {
        toast.error(`Erro no jogo automático: ${error.message}`);
        return false;
      }
      
      toast.success('Jogada automática realizada!');
      return true;
    } catch (error) {
      console.error('Erro no auto play:', error);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [gameState.id, isProcessingMove]);

  return {
    gameState,
    playersState,
    playPiece,
    passTurn,
    playAutomatic,
    isMyTurn,
    isProcessingMove,
    currentAction,
    retryCount,
    pendingMovesCount: pendingMoves.length,
    connectionStatus
  };
};
