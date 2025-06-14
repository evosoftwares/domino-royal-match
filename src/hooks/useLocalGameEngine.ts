
import { useState, useCallback, useEffect, useMemo } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { validateMove, standardizePiece, toBackendFormat, extractBoardEnds } from '@/utils/pieceValidation';
import { toast } from 'sonner';

interface UseLocalGameEngineProps {
  gameData: GameData;
  players: PlayerData[];
  userId?: string;
}

export const useLocalGameEngine = ({
  gameData: initialGameData,
  players: initialPlayers,
  userId
}: UseLocalGameEngineProps) => {
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);

  useEffect(() => {
    setGameState(initialGameData);
  }, [initialGameData]);

  useEffect(() => {
    setPlayersState(initialPlayers);
  }, [initialPlayers]);
  
  const isMyTurn = useMemo(() => gameState.current_player_turn === userId, [gameState.current_player_turn, userId]);

  const getNextPlayerId = useCallback(() => {
    const sortedPlayers = [...playersState].sort((a, b) => a.position - b.position);
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
    return sortedPlayers[nextPlayerIndex]?.user_id;
  }, [playersState, gameState.current_player_turn]);

  const playPiece = useCallback((piece: DominoPieceType) => {
    if (gameState.current_player_turn !== userId) {
        toast.error("Não é sua vez de jogar.");
        return;
    }

    const validation = validateMove(piece, gameState.board_state);
    if (!validation.isValid || !validation.side) {
        toast.error(validation.error || 'Jogada inválida');
        return;
    }
    
    // 1. Update Player's Hand
    const standardPieceToPlay = standardizePiece(piece);
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
    } else { // side === 'right'
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
    
    toast.success('Peça jogada (localmente)!');

  }, [gameState, playersState, userId, getNextPlayerId]);

  const passTurn = useCallback(() => {
    if (gameState.current_player_turn !== userId) {
        toast.error("Não é sua vez de passar.");
        return;
    }
    
    const nextPlayerId = getNextPlayerId();
    setGameState(prev => ({
      ...prev,
      current_player_turn: nextPlayerId,
    }));
    toast.info('Você passou a vez (localmente).');

  }, [gameState.current_player_turn, userId, getNextPlayerId]);

  return {
    gameState,
    playersState,
    playPiece,
    passTurn,
    isMyTurn,
    isProcessingMove: false,
    currentAction: null,
  };
};
