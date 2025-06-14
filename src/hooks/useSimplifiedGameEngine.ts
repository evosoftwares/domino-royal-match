
import { useState, useCallback, useEffect, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { gameCache } from '@/utils/gameCache';
import { useErrorHandler } from '@/utils/errorHandler';
import { standardizePieceFormat, createStandardDominoPiece, validateMove, toBackendFormat } from '@/utils/standardPieceValidation';
import { supabase } from '@/integrations/supabase/client';

interface UseSimplifiedGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

type ActionType = 'playing' | 'passing' | 'auto_playing' | null;
type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export const useSimplifiedGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseSimplifiedGameEngineProps) => {
  // Estados simplificados
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [pendingMovesCount, setPendingMovesCount] = useState(0);
  
  const { handleSupabaseError, handleValidationError, handleGameStateError } = useErrorHandler();

  // Valores computados otimizados
  const isMyTurn = useMemo(() => 
    gameState.current_player_turn === userId, 
    [gameState.current_player_turn, userId]
  );
  
  const isProcessingMove = useMemo(() => 
    currentAction !== null || pendingMovesCount > 0, 
    [currentAction, pendingMovesCount]
  );

  // Atualização de estado local simplificada
  const updateGameState = useCallback((newGameData: GameData) => {
    setGameState(prev => {
      if (prev.id === newGameData.id) {
        console.log('🔄 Atualizando estado do jogo:', newGameData.id);
        return newGameData;
      }
      return prev;
    });
  }, []);

  const updatePlayerState = useCallback((updatedPlayer: PlayerData) => {
    setPlayersState(prev => 
      prev.map(player => 
        player.user_id === updatedPlayer.user_id ? updatedPlayer : player
      )
    );
  }, []);

  // Aplicação de movimento local otimizada
  const applyLocalMove = useCallback((piece: DominoPieceType) => {
    try {
      const standardPiece = standardizePieceFormat(piece);
      const validation = validateMove(standardPiece, gameState.board_state);
      
      if (!validation.isValid) {
        const error = handleValidationError(validation.error || 'Movimento inválido');
        throw new Error(error.message);
      }

      // Atualizar estado local
      setGameState(prev => ({
        ...prev,
        board_state: {
          ...prev.board_state,
          pieces: [...(prev.board_state?.pieces || []), { piece: standardPiece }]
        }
      }));

      // Remover peça da mão do jogador
      setPlayersState(prev => 
        prev.map(player => {
          if (player.user_id === userId) {
            const newHand = player.hand.filter((p: any) => {
              const standardP = standardizePieceFormat(p);
              return !(standardP.top === standardPiece.top && standardP.bottom === standardPiece.bottom);
            });
            return { ...player, hand: newHand };
          }
          return player;
        })
      );

      return true;
    } catch (error: any) {
      console.error('❌ Erro ao aplicar movimento local:', error);
      return false;
    }
  }, [gameState.board_state, userId, handleValidationError]);

  // Aplicação de passe local
  const applyLocalPass = useCallback(() => {
    // Atualizar turno localmente
    const currentPlayerIndex = playersState.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playersState.length;
    const nextPlayer = playersState[nextPlayerIndex];

    setGameState(prev => ({
      ...prev,
      current_player_turn: nextPlayer?.user_id || null
    }));
  }, [playersState, gameState.current_player_turn]);

  // Sincronização com servidor simplificada
  const syncPlayMove = useCallback(async (piece: DominoPieceType) => {
    try {
      setPendingMovesCount(prev => prev + 1);
      
      const pieceForRPC = piece.originalFormat || toBackendFormat({
        top: piece.top,
        bottom: piece.bottom
      });

      const { data, error } = await supabase.rpc('play_move', {
        p_game_id: gameState.id,
        p_piece: pieceForRPC,
        p_side: 'left'
      });

      if (error) {
        const gameError = handleSupabaseError(error, 'play_move');
        throw new Error(gameError.message);
      }

      return true;
    } catch (error: any) {
      console.error('❌ Erro na sincronização de movimento:', error);
      return false;
    } finally {
      setPendingMovesCount(prev => Math.max(0, prev - 1));
    }
  }, [gameState.id, handleSupabaseError]);

  const syncPassTurn = useCallback(async () => {
    try {
      setPendingMovesCount(prev => prev + 1);
      
      const { data, error } = await supabase.rpc('pass_turn', {
        p_game_id: gameState.id
      });

      if (error) {
        const gameError = handleSupabaseError(error, 'pass_turn');
        throw new Error(gameError.message);
      }

      return true;
    } catch (error: any) {
      console.error('❌ Erro na sincronização de passe:', error);
      return false;
    } finally {
      setPendingMovesCount(prev => Math.max(0, prev - 1));
    }
  }, [gameState.id, handleSupabaseError]);

  // Ações do jogo simplificadas
  const playPiece = useCallback(async (piece: DominoPieceType) => {
    if (isProcessingMove || !isMyTurn) {
      toast.error('Não é sua vez ou já está processando uma ação');
      return false;
    }

    setCurrentAction('playing');

    try {
      const localSuccess = applyLocalMove(piece);
      if (!localSuccess) {
        toast.error('Jogada inválida');
        return false;
      }

      const serverSuccess = await syncPlayMove(piece);
      if (serverSuccess) {
        toast.success('Peça jogada com sucesso!');
      } else {
        toast.error('Erro ao sincronizar com servidor');
      }

      return serverSuccess;
    } catch (error: any) {
      console.error('❌ Erro ao jogar peça:', error);
      toast.error('Erro ao jogar peça');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, isMyTurn, applyLocalMove, syncPlayMove]);

  const passTurn = useCallback(async () => {
    if (isProcessingMove || !isMyTurn) {
      toast.error('Não é sua vez ou já está processando uma ação');
      return false;
    }

    setCurrentAction('passing');

    try {
      applyLocalPass();
      const serverSuccess = await syncPassTurn();
      
      if (serverSuccess) {
        toast.info('Você passou a vez');
      } else {
        toast.error('Erro ao sincronizar passe');
      }

      return serverSuccess;
    } catch (error: any) {
      console.error('❌ Erro ao passar a vez:', error);
      toast.error('Erro ao passar a vez');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, isMyTurn, applyLocalPass, syncPassTurn]);

  const playAutomatic = useCallback(async () => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    
    try {
      const { data, error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) {
        const gameError = handleSupabaseError(error, 'auto_play');
        throw new Error(gameError.message);
      }
      
      toast.success('Jogada automática realizada!');
      return true;
    } catch (error: any) {
      console.error('❌ Erro no auto play:', error);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, gameState.id, handleSupabaseError]);

  // Sincronização em tempo real simplificada
  useEffect(() => {
    const gameChannel = supabase
      .channel(`game-${gameState.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameState.id}`
      }, (payload) => {
        console.log('🔄 Atualização do jogo via realtime:', payload.new);
        updateGameState(payload.new as GameData);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameState.id}`
      }, (payload) => {
        console.log('👤 Atualização do jogador via realtime:', payload.new);
        updatePlayerState(payload.new as PlayerData);
      })
      .subscribe((status) => {
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      supabase.removeChannel(gameChannel);
    };
  }, [gameState.id, updateGameState, updatePlayerState]);

  // Limpeza automática do cache
  useEffect(() => {
    const interval = setInterval(() => {
      gameCache.optimize();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    gameState,
    playersState,
    playPiece,
    passTurn,
    playAutomatic,
    isMyTurn,
    isProcessingMove,
    currentAction,
    pendingMovesCount,
    connectionStatus,
    
    // Utilitários
    updateGameState,
    updatePlayerState
  };
};
