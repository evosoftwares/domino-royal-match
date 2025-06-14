
import { useState, useCallback } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { validateMove, toBackendFormat, extractBoardEnds, arePiecesEqual } from '@/utils/pieceValidation';

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

      // Usar peça já padronizada diretamente
      const validation = validateMove(piece, gameState.board_state);
      if (!validation.isValid || !validation.side) {
        console.error('Movimento inválido:', validation.error);
        return false;
      }

      const standardPieceToPlay = { top: piece.top, bottom: piece.bottom };
      console.log('Aplicando movimento local com peça padronizada:', standardPieceToPlay);
      
      // Update Player's Hand - busca mais robusta com comparação padronizada
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
              // Usa função de comparação robusta e padronizada
              if (arePiecesEqual(p_piece, standardPieceToPlay)) {
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

      // Update Board State - usando formato padronizado
      const currentBoardPieces = gameState.board_state?.pieces || [];
      const boardEnds = extractBoardEnds(gameState.board_state);
      const side = validation.side;

      let newPieces = [...currentBoardPieces];
      let newLeftEnd = boardEnds.left;
      let newRightEnd = boardEnds.right;

      if (newPieces.length === 0) {
        // Primeira peça do jogo
        newPieces.push({ piece: toBackendFormat(standardPieceToPlay), rotation: 0 });
        newLeftEnd = standardPieceToPlay.top;
        newRightEnd = standardPieceToPlay.bottom;
      } else if (side === 'left') {
        // Adicionar à esquerda
        let pieceForBoard;
        if (standardPieceToPlay.bottom === boardEnds.left) {
          newLeftEnd = standardPieceToPlay.top;
          pieceForBoard = toBackendFormat(standardPieceToPlay);
        } else {
          newLeftEnd = standardPieceToPlay.bottom;
          pieceForBoard = { l: standardPieceToPlay.bottom, r: standardPieceToPlay.top };
        }
        newPieces.unshift({ piece: pieceForBoard, rotation: 0 });
      } else {
        // Adicionar à direita
        let pieceForBoard;
        if (standardPieceToPlay.top === boardEnds.right) {
          newRightEnd = standardPieceToPlay.bottom;
          pieceForBoard = toBackendFormat(standardPieceToPlay);
        } else {
          newRightEnd = standardPieceToPlay.top;
          pieceForBoard = { l: standardPieceToPlay.bottom, r: standardPieceToPlay.top };
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

      console.log('Movimento local aplicado com sucesso. Novo estado:', {
        newBoardState,
        nextPlayerId
      });

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
    console.log('Passe local aplicado. Próximo jogador:', nextPlayerId);
  }, [getNextPlayerId]);

  const updateGameState = useCallback((newGameState: GameData) => {
    console.log('Atualizando estado do jogo via realtime:', newGameState.id);
    setGameState(newGameState);
  }, []);

  const updatePlayerState = useCallback((updatedPlayer: PlayerData) => {
    console.log('Atualizando estado do jogador via realtime:', updatedPlayer.user_id);
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
