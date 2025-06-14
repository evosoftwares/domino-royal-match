import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';
import { validateMove, standardizePiece, toBackendFormat, extractBoardEnds } from '@/utils/pieceValidation';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useOptimizedStateControl } from './useOptimizedStateControl';
import { useOptimizedPendingMoves } from './useOptimizedPendingMoves';

interface UseHybridGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;

export const useHybridGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseHybridGameEngineProps) => {
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  
  // Refs otimizados
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const heartbeatRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  // Hooks otimizados
  const stateControl = useOptimizedStateControl();
  
  const pendingMoves = useOptimizedPendingMoves({
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 8000,
    onMoveSuccess: (moveId) => {
      console.log('Movimento sincronizado com sucesso:', moveId);
    },
    onMoveFailure: (moveId, error) => {
      console.error('Falha ao sincronizar movimento:', moveId, error);
      toast.error('Falha ao sincronizar movimento');
    }
  });

  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);
  const isProcessingMove = pendingMoves.isProcessing || currentAction !== null;

  const getNextPlayerId = useCallback(() => {
    const sortedPlayers = [...playersState].sort((a, b) => a.position - b.position);
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
    return sortedPlayers[nextPlayerIndex]?.user_id;
  }, [playersState, gameState.current_player_turn]);

  // Heartbeat otimizado com timing adaptativo
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;
      
      if (timeSinceLastHeartbeat > 15000) {
        setConnectionStatus('disconnected');
      } else if (timeSinceLastHeartbeat > 8000) {
        setConnectionStatus('reconnecting');
      } else {
        setConnectionStatus('connected');
      }
    }, 2000);
  }, []);

  // Debounced update com validação de estado
  const debouncedStateUpdate = useCallback((updateFn: () => void, delay: number = 200) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateFn();
    }, delay);
  }, []);

  // Função de sincronização otimizada
  const syncWithServer = useCallback(async (move: any) => {
    try {
      if (move.type === 'play' && move.piece) {
        const pieceForRPC = move.piece.originalFormat || toBackendFormat(standardizePiece(move.piece));
        const validation = validateMove(move.piece, gameState.board_state);
        
        const { error } = await supabase.rpc('play_move', {
          p_game_id: gameState.id,
          p_piece: pieceForRPC,
          p_side: validation.side
        });

        if (error) throw error;
      } else if (move.type === 'pass') {
        const { error } = await supabase.rpc('pass_turn', {
          p_game_id: gameState.id
        });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Erro na sincronização:', error);
      return false;
    }
  }, [gameState.id, gameState.board_state]);

  // Setup realtime otimizado
  useEffect(() => {
    if (!gameState.id) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    try {
      const gameChannel = supabase.channel(`hybrid-game:${gameState.id}`, {
        config: {
          presence: { key: userId }
        }
      });
      channelRef.current = gameChannel;

      gameChannel.on<GameData>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameState.id}` },
        (payload) => {
          lastHeartbeatRef.current = Date.now();
          
          const stateVersion = stateControl.createStateVersion('realtime');
          
          debouncedStateUpdate(() => {
            if (stateControl.shouldApplyUpdate(payload.new, gameState)) {
              setGameState(payload.new as GameData);
            }
          }, 150);
        }
      );

      gameChannel.on<PlayerData>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameState.id}` },
        (payload) => {
          lastHeartbeatRef.current = Date.now();

          debouncedStateUpdate(() => {
            if (payload.eventType === 'UPDATE') {
              setPlayersState(current => 
                current.map(p => p.id === payload.new.id ? payload.new as PlayerData : p)
              );
            }
          }, 150);
        }
      );

      gameChannel.subscribe((status) => {
        lastHeartbeatRef.current = Date.now();
        
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          startHeartbeat();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    } catch (error) {
      console.error('Erro ao configurar realtime:', error);
      setConnectionStatus('disconnected');
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [gameState.id, userId, debouncedStateUpdate, startHeartbeat, stateControl]);

  // Auto-processar movimentos pendentes
  useEffect(() => {
    if (pendingMoves.pendingCount > 0) {
      const nextMove = pendingMoves.getNextMoveToProcess();
      if (nextMove) {
        pendingMoves.processNextMove(syncWithServer);
      }
    }
  }, [pendingMoves, syncWithServer]);

  // Aplicar mudança local (optimistic update) com validação defensiva
  const applyLocalMove = useCallback((piece: DominoPieceType) => {
    try {
      // Validação defensiva do estado do jogo
      if (!gameState?.board_state) {
        console.error('Estado do tabuleiro inválido');
        return false;
      }

      const validation = validateMove(piece, gameState.board_state);
      if (!validation.isValid || !validation.side) {
        return false;
      }

      const standardPieceToPlay = standardizePiece(piece);
      
      // 1. Update Player's Hand com validação
      const updatedPlayers = playersState.map(p => {
        if (p.user_id === userId) {
          if (!p.hand || !Array.isArray(p.hand)) {
            console.error('Hand do jogador inválida:', p.hand);
            return p;
          }

          let found = false;
          const newHand = p.hand.filter((p_piece: any) => {
            if (found) return true;
            try {
              const standard = standardizePiece(p_piece);
              const isMatch = (standard.left === standardPieceToPlay.left && standard.right === standardPieceToPlay.right) ||
                              (standard.left === standardPieceToPlay.right && standard.right === standardPieceToPlay.left);
              if (isMatch) {
                found = true;
                return false;
              }
              return true;
            } catch (e) {
              console.error('Erro ao processar peça na mão:', p_piece, e);
              return true; // Manter peça se houver erro
            }
          });
          return { ...p, hand: newHand };
        }
        return p;
      });
      setPlayersState(updatedPlayers);

      // 2. Update Board State com fallbacks
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
    } catch (error) {
      console.error('Erro ao aplicar movimento local:', error);
      return false;
    }
  }, [gameState, playersState, userId, getNextPlayerId]);

  // Aplicar passe local
  const applyLocalPass = useCallback(() => {
    const nextPlayerId = getNextPlayerId();
    setGameState(prev => ({
      ...prev,
      current_player_turn: nextPlayerId,
    }));
  }, [getNextPlayerId]);

  const playPiece = useCallback(async (piece: DominoPieceType) => {
    if (isProcessingMove) {
      console.warn("Tentativa de jogar enquanto processando movimento anterior");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de jogar.");
      return false;
    }

    setCurrentAction('playing');

    try {
      const localSuccess = applyLocalMove(piece);
      
      if (!localSuccess) {
        toast.error('Jogada inválida');
        return false;
      }

      pendingMoves.addPendingMove({
        type: 'play',
        piece,
        priority: 1
      });

      return true;
    } catch (error) {
      console.error('Erro ao jogar peça:', error);
      toast.error('Erro ao jogar peça');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalMove, pendingMoves]);

  const passTurn = useCallback(async () => {
    if (isProcessingMove) {
      console.warn("Tentativa de passar enquanto processando ação anterior");
      return false;
    }

    if (!userId || gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de passar.");
      return false;
    }

    setCurrentAction('passing');

    try {
      applyLocalPass();

      pendingMoves.addPendingMove({
        type: 'pass',
        priority: 2
      });

      return true;
    } catch (error) {
      console.error('Erro ao passar a vez:', error);
      toast.error('Erro ao passar a vez');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, userId, gameState.current_player_turn, applyLocalPass, pendingMoves]);

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
    retryCount: 0, // Deprecated - usar pendingMoves.pendingCount
    pendingMovesCount: pendingMoves.pendingCount,
    connectionStatus
  };
};
