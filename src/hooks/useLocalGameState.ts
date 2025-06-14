
import { useState, useCallback } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { validateMove, standardizePiece, toBackendFormat, extractBoardEnds } from '@/utils/pieceValidation';

interface UseLocalGameStateProps {
  initialGameData: GameData;
  initialPlayers: PlayerData[];
  userId?: string;
}

export const useLocalGameState = ({
  initialGameData,
  initialPlayers,
  userId
}: UseLocalGameStateProps) => {
  const [gameState, setGameState] = useState<GameData>(initialGameData);
  const [playersState, setPlayersState] = useState<PlayerData[]>(initialPlayers);

  const getNextPlayerId = useCallback(() => {
    const sortedPlayers = [...playersState].sort((a, b) => a.position - b.position);
    const currentPlayerIndex = sortedPlayers.findIndex(p => p.user_id === gameState.current_player_turn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % sortedPlayers.length;
    return sortedPlayers[nextPlayerIndex]?.user_id;
  }, [playersState, gameState.current_player_turn]);

  const applyLocalMove = useCallback((piece: DominoPieceType) => {
    try {
      if (!gameState?.board_state) {
        console.error('Estado do tabuleiro inválido');
        return false;
      }

      const validation = validateMove(piece, gameState.board_state);
      if (!validation.isValid || !validation.side) {
        return false;
      }

      const standardPieceToPlay = standardizePiece(piece);
      
      // Update Player's Hand
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
              return true;
            }
          });
          return { ...p, hand: newHand };
        }
        return p;
      });
      setPlayersState(updatedPlayers);

      // Update Board State
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

  const applyLocalPass = useCallback(() => {
    const nextPlayerId = getNextPlayerId();
    setGameState(prev => ({
      ...prev,
      current_player_turn: nextPlayerId,
    }));
  }, [getNextPlayerId]);

  const updateGameState = useCallback((newGameState: GameData) => {
    setGameState(newGameState);
  }, []);

  const updatePlayerState = useCallback((updatedPlayer: PlayerData) => {
    setPlayersState(current => 
      current.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)
    );
  }, []);

  return {
    gameState,
    playersState,
    applyLocalMove,
    applyLocalPass,
    updateGameState,
    updatePlayerState
  };
};
