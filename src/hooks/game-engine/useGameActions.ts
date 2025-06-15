
import { useCallback } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { usePersistentQueue } from '../usePersistentQueue';
import { useGameMetricsIntegration } from '../useGameMetricsIntegration';
import { standardizePieceFormat, validateMove, canPieceConnect, extractBoardEnds } from '@/utils/standardPieceValidation';
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
        const gameUpdatePromise = supabase
          .from('games')
          .update({
            board_state: newBoardState,
            current_player_turn: nextPlayerUserId,
            consecutive_passes: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', gameState.id);

        const playerUpdatePromise = supabase
          .from('game_players')
          .update({ 
            hand: newPlayerHand,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentPlayer.id);

        const [gameUpdateResult, playerUpdateResult] = await Promise.all([
            gameUpdatePromise,
            playerUpdatePromise,
        ]);

        if (gameUpdateResult.error || playerUpdateResult.error) {
            throw gameUpdateResult.error || playerUpdateResult.error;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Play Piece', performance.now() - startTime);
        setSyncStatus('synced');
        toast.success("Jogada sincronizada!");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Play Piece Sync', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao sincronizar jogada: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, userId, gameMetrics, persistentQueue, setGameState, setPlayersState, setCurrentAction, setSyncStatus]);

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
        const { error } = await supabase
            .from('games')
            .update({
                current_player_turn: nextPlayerUserId,
                consecutive_passes: newConsecutivePasses,
                updated_at: new Date().toISOString(),
            })
            .eq('id', gameState.id);

        if (error) {
            throw error;
        }

        persistentQueue.cleanupExpired();
        gameMetrics.recordGameSuccess('Pass Turn', performance.now() - startTime);
        setSyncStatus('synced');
        toast.info("Você passou a vez.");
        return true;
    } catch (error: any) {
        gameMetrics.recordGameError('Pass Turn Sync', error, performance.now() - startTime);
        setSyncStatus('failed');
        toast.error(`Erro ao passar a vez: ${error.message}`);
        return false;
    } finally {
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState, playersState, gameMetrics, persistentQueue, setGameState, setCurrentAction, setSyncStatus]);

  const playAutomatic = useCallback(async (): Promise<boolean> => {
    if (!isMyTurn || isProcessingMove) {
        toast.warning('Não é sua vez ou uma jogada já está em processamento.');
        return false;
    }

    setCurrentAction('auto_playing');
    const startTime = performance.now();
    gameMetrics.recordGameAction('playAutomatic_start');

    const currentPlayer = playersState.find(p => p.user_id === userId);
    if (!currentPlayer || !currentPlayer.hand || !Array.isArray(currentPlayer.hand)) {
        toast.error('Não foi possível encontrar seus dados ou sua mão está vazia.');
        setCurrentAction(null);
        return false;
    }

    const boardEnds = extractBoardEnds(gameState.board_state);
    
    let pieceToPlay: DominoPieceType | null = null;

    // Encontra a primeira peça jogável na mão
    for (const p of currentPlayer.hand) {
        const standardPiece = standardizePieceFormat(p);
        if (canPieceConnect(standardPiece, boardEnds)) {
            pieceToPlay = {
                ...standardPiece,
                id: `auto-${standardPiece.top}-${standardPiece.bottom}-${Math.random()}`,
                originalFormat: p,
            };
            break; 
        }
    }

    try {
        let success = false;
        if (pieceToPlay) {
            toast.info(`Jogando peça automaticamente: [${pieceToPlay.top}|${pieceToPlay.bottom}]`);
            success = await playPiece(pieceToPlay);
        } else {
            toast.info('Nenhuma peça jogável, passando a vez automaticamente.');
            success = await passTurn();
        }
        return success;
    } catch (error: any) {
        console.error('❌ Erro na jogada automática:', error);
        gameMetrics.recordGameError('Auto Play', error, performance.now() - startTime);
        toast.error('Erro na jogada automática');
        return false;
    } finally {
        gameMetrics.recordGameSuccess('Auto Play', performance.now() - startTime);
        setCurrentAction(null);
    }
  }, [isMyTurn, isProcessingMove, gameState.board_state, playersState, userId, playPiece, passTurn, setCurrentAction, gameMetrics]);

  return { playPiece, passTurn, playAutomatic };
};
