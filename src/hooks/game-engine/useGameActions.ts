
import { useCallback } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { useOptimisticLocking } from '../useOptimisticLocking';
import { usePersistentQueue } from '../usePersistentQueue';
import { useGameMetricsIntegration } from '../useGameMetricsIntegration';
import { standardizePieceFormat, validateMove } from '@/utils/standardPieceValidation';
import { getNextPlayerId, calculateNewBoardState, removePieceFromHand } from '@/utils/gameLogic';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ActionType, SyncStatus } from './useGameStatus';

interface UseGameActionsProps {
  gameState: GameData;
  playersState: PlayerData[];
  userId?: string;
  isMyTurn: boolean;
  isProcessingMove: boolean;
  setGameState: React.Dispatch<React.SetStateAction<GameData>>;
  setPlayersState: React.Dispatch<React.SetStateAction<PlayerData[]>>;
  setCurrentAction: React.Dispatch<React.SetStateAction<ActionType>>;
  setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
  persistentQueue: ReturnType<typeof usePersistentQueue>;
  gameMetrics: ReturnType<typeof useGameMetricsIntegration>;
}

export const useGameActions = ({
  gameState,
  playersState,
  userId,
  isMyTurn,
  isProcessingMove,
  setGameState,
  setPlayersState,
  setCurrentAction,
  setSyncStatus,
  persistentQueue,
  gameMetrics,
}: UseGameActionsProps) => {
  const { executeGameOperation, executePlayerOperation } = useOptimisticLocking();

  const playPiece = useCallback(async (piece: DominoPieceType): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      toast.warning('Aguarde, processando jogada anterior ou não é sua vez.');
      return false;
    }

    setCurrentAction('playing');
    setSyncStatus('pending');
    gameMetrics.recordGameAction('playPiece_start');
    
    const startTime = performance.now();
    
    persistentQueue.addItem({ type: 'play_move', data: { piece }, retries: 0, priority: 1 });
    
    const currentPlayer = playersState.find(p => p.user_id === userId);
    if (!currentPlayer) {
        toast.error("Jogador atual não encontrado.");
        setCurrentAction(null);
        return false;
    }
    
    const standardPiece = standardizePieceFormat(piece);
    const validation = validateMove(standardPiece, gameState.board_state);
    if (!validation.isValid || !validation.side) {
        toast.error(validation.error || "Jogada inválida.");
        setCurrentAction(null);
        return false;
    }
    
    const newBoardState = calculateNewBoardState(gameState.board_state, standardPiece, validation.side);
    const newPlayerHand = removePieceFromHand(currentPlayer.hand, standardPiece);
    const nextPlayerUserId = getNextPlayerId(gameState.current_player_turn, playersState);

    setGameState(prev => ({ ...prev, board_state: newBoardState, current_player_turn: nextPlayerUserId, consecutive_passes: 0 }));
    setPlayersState(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, hand: newPlayerHand } : p));
    
    try {
        const gameUpdateResult = await executeGameOperation(
            gameState.id,
            () => Promise.resolve({
                board_state: newBoardState,
                current_player_turn: nextPlayerUserId,
                consecutive_passes: 0
            })
        );

        const playerUpdateResult = await executePlayerOperation(
            currentPlayer.id,
            () => Promise.resolve({ hand: newPlayerHand })
        );

        if (!gameUpdateResult.success || !playerUpdateResult.success) {
            toast.error("Conflito de sincronização. A reconciliação será iniciada.");
            setSyncStatus('conflict');
            gameMetrics.recordGameError('Play Piece Conflict', new Error(gameUpdateResult.error || playerUpdateResult.error), performance.now() - startTime);
            return false;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Play Piece', performance.now() - startTime);
        setSyncStatus('synced');
        toast.success("Jogada sincronizada!");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Play Piece', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao sincronizar jogada: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, userId, executeGameOperation, executePlayerOperation, gameMetrics, persistentQueue, setGameState, setPlayersState, setCurrentAction, setSyncStatus]);

  const passTurn = useCallback(async (): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
      toast.warning('Aguarde, processando jogada anterior ou não é sua vez.');
      return false;
    }

    setCurrentAction('passing');
    setSyncStatus('pending');
    gameMetrics.recordGameAction('passTurn_start');
    const startTime = performance.now();
    
    persistentQueue.addItem({ type: 'pass_turn', data: {}, retries: 0, priority: 1 });
    
    const nextPlayerUserId = getNextPlayerId(gameState.current_player_turn, playersState);
    const newConsecutivePasses = (gameState.consecutive_passes || 0) + 1;
    
    setGameState(prev => ({...prev, current_player_turn: nextPlayerUserId, consecutive_passes: newConsecutivePasses }));
    
    try {
        const result = await executeGameOperation(
            gameState.id,
            (serverGame) => Promise.resolve({
                current_player_turn: nextPlayerUserId,
                consecutive_passes: (serverGame.consecutive_passes || 0) + 1
            })
        );

        if (!result.success) {
            toast.error("Conflito ao passar o turno.");
            setSyncStatus('conflict');
            gameMetrics.recordGameError('Pass Turn Conflict', new Error(result.error), performance.now() - startTime);
            return false;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Pass Turn', performance.now() - startTime);
        setSyncStatus('synced');
        toast.info("Você passou a vez.");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Pass Turn', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao passar a vez: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, executeGameOperation, gameMetrics, persistentQueue, setGameState, setCurrentAction, setSyncStatus]);

  const playAutomatic = useCallback(async (): Promise<boolean> => {
    if (isProcessingMove) return false;

    setCurrentAction('auto_playing');
    const startTime = performance.now();
    
    try {
      const { data, error } = await supabase.rpc('play_piece_periodically', {
        p_game_id: gameState.id,
      });
      
      if (error) throw error;
      
      gameMetrics.recordGameSuccess('Auto Play', performance.now() - startTime);
      toast.success('Jogada automática realizada!');
      return true;
    } catch (error: any) {
      console.error('❌ Erro no auto play:', error);
      gameMetrics.recordGameError('Auto Play', error, performance.now() - startTime);
      toast.error('Erro no jogo automático');
      return false;
    } finally {
      setCurrentAction(null);
    }
  }, [isProcessingMove, gameState.id, gameMetrics, setCurrentAction]);

  return { playPiece, passTurn, playAutomatic };
};
