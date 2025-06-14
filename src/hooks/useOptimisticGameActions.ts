
import { useCallback } from 'react';
import { DominoPieceType, GameData, PlayerData } from '@/types/game';
import { standardizePieceFormat, validateMove, toBackendFormat } from '@/utils/standardPieceValidation';
import { useTwoPhaseCommit } from './useTwoPhaseCommit';
import { useServerSync } from './useServerSync';
import { toast } from 'sonner';

interface UseOptimisticGameActionsProps {
  gameState: GameData;
  playersState: PlayerData[];
  userId?: string;
  onStateUpdate: (gameState: GameData, playersState: PlayerData[]) => void;
}

export const useOptimisticGameActions = ({
  gameState,
  playersState,
  userId,
  onStateUpdate
}: UseOptimisticGameActionsProps) => {
  // Two-phase commit hook
  const {
    applyOptimisticUpdate,
    commitOperation,
    rollbackOperation,
    hasPendingOperations,
    pendingCount,
    getStats
  } = useTwoPhaseCommit({
    gameState,
    playersState,
    onStateUpdate
  });

  // Server sync hook
  const { syncPlayMove, syncPassTurn } = useServerSync({
    gameId: gameState.id,
    boardState: gameState.board_state
  });

  // Helper: obter próximo jogador
  const getNextPlayerId = useCallback(() => {
    const currentPlayerIndex = playersState.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playersState.length;
    return playersState[nextPlayerIndex]?.user_id || null;
  }, [playersState, gameState.current_player_turn]);

  // Helper: aplicar jogada no estado local
  const applyMoveLocally = useCallback((piece: DominoPieceType, currentGame: GameData, currentPlayers: PlayerData[]) => {
    try {
      const standardPiece = standardizePieceFormat(piece);
      const validation = validateMove(standardPiece, currentGame.board_state);
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Jogada inválida');
      }

      // Atualizar estado local do jogo
      const newGameState: GameData = {
        ...currentGame,
        board_state: {
          ...currentGame.board_state,
          pieces: [...(currentGame.board_state?.pieces || []), { 
            piece: toBackendFormat(standardPiece), 
            rotation: 0 
          }]
        },
        current_player_turn: getNextPlayerId(),
        updated_at: new Date().toISOString()
      };

      // Remover peça da mão do jogador
      const newPlayersState = currentPlayers.map(player => {
        if (player.user_id === userId) {
          const newHand = player.hand.filter((p: any) => {
            const standardP = standardizePieceFormat(p);
            return !(standardP.top === standardPiece.top && standardP.bottom === standardPiece.bottom);
          });
          return { ...player, hand: newHand };
        }
        return player;
      });

      console.log('✅ Jogada aplicada localmente:', {
        piece: standardPiece,
        newGameState: newGameState.id,
        newTurn: newGameState.current_player_turn
      });

      return { gameState: newGameState, playersState: newPlayersState };
    } catch (error) {
      console.error('❌ Erro ao aplicar jogada localmente:', error);
      throw error;
    }
  }, [userId, getNextPlayerId]);

  // Helper: aplicar passe no estado local
  const applyPassLocally = useCallback((currentGame: GameData) => {
    const newGameState: GameData = {
      ...currentGame,
      current_player_turn: getNextPlayerId(),
      updated_at: new Date().toISOString()
    };

    console.log('✅ Passe aplicado localmente:', {
      previousTurn: currentGame.current_player_turn,
      newTurn: newGameState.current_player_turn
    });

    return { gameState: newGameState, playersState };
  }, [playersState, getNextPlayerId]);

  // AÇÃO PRINCIPAL: Jogar peça com Two-Phase Commit
  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de jogar");
      return false;
    }

    if (hasPendingOperations) {
      toast.warning("Aguarde a sincronização da jogada anterior");
      return false;
    }

    try {
      // FASE 1: Aplicar otimisticamente e obter ID da operação
      const localUpdate = applyMoveLocally(piece, gameState, playersState);
      const operationId = applyOptimisticUpdate({
        type: 'play_move',
        data: { piece }
      });

      // Aplicar estado local imediatamente para UX responsiva
      onStateUpdate(localUpdate.gameState, localUpdate.playersState);
      toast.success("Peça jogada! (sincronizando...)");

      // FASE 2: Sincronizar com servidor em background
      try {
        const success = await syncPlayMove(piece);
        
        if (success) {
          commitOperation(operationId);
          console.log('✅ Jogada confirmada pelo servidor');
        } else {
          rollbackOperation(operationId, 'rejected');
          toast.error("Jogada rejeitada pelo servidor");
          return false;
        }
      } catch (syncError) {
        console.error('❌ Erro na sincronização:', syncError);
        rollbackOperation(operationId, 'rejected');
        toast.error("Erro de conexão - jogada revertida");
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao jogar peça:', error);
      toast.error(error.message || "Erro ao jogar peça");
      return false;
    }
  }, [gameState, playersState, userId, hasPendingOperations, applyMoveLocally, applyOptimisticUpdate, onStateUpdate, syncPlayMove, commitOperation, rollbackOperation]);

  // AÇÃO PRINCIPAL: Passar turno com Two-Phase Commit
  const passTurn = useCallback(async (): Promise<boolean> => {
    if (gameState.current_player_turn !== userId) {
      toast.error("Não é sua vez de passar");
      return false;
    }

    if (hasPendingOperations) {
      toast.warning("Aguarde a sincronização da ação anterior");
      return false;
    }

    try {
      // FASE 1: Aplicar otimisticamente
      const localUpdate = applyPassLocally(gameState);
      const operationId = applyOptimisticUpdate({
        type: 'pass_turn'
      });

      // Aplicar estado local imediatamente
      onStateUpdate(localUpdate.gameState, localUpdate.playersState);
      toast.info("Você passou a vez! (sincronizando...)");

      // FASE 2: Sincronizar com servidor
      try {
        const success = await syncPassTurn();
        
        if (success) {
          commitOperation(operationId);
          console.log('✅ Passe confirmado pelo servidor');
        } else {
          rollbackOperation(operationId, 'rejected');
          toast.error("Passe rejeitado pelo servidor");
          return false;
        }
      } catch (syncError) {
        console.error('❌ Erro na sincronização do passe:', syncError);
        rollbackOperation(operationId, 'rejected');
        toast.error("Erro de conexão - passe revertido");
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro ao passar turno:', error);
      toast.error("Erro ao passar turno");
      return false;
    }
  }, [gameState, userId, hasPendingOperations, applyPassLocally, applyOptimisticUpdate, onStateUpdate, syncPassTurn, commitOperation, rollbackOperation]);

  return {
    // Ações principais
    playPiece,
    passTurn,
    
    // Estado
    isProcessingMove: hasPendingOperations,
    pendingOperationsCount: pendingCount,
    
    // Métricas para debug
    stats: getStats()
  };
};
