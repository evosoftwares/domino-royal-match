
import { GameData, PlayerData, StandardPieceFormat } from '@/types/game';
import { standardizePieceFormat } from '@/utils/standardPieceValidation';

export const getNextPlayerId = (currentPlayerId: string | null, players: PlayerData[]): string | null => {
    if (!currentPlayerId || players.length === 0) return null;
    const sortedPlayers = [...players].sort((a, b) => a.position - b.position);
    const currentIndex = sortedPlayers.findIndex(p => p.user_id === currentPlayerId);
    if (currentIndex === -1) return sortedPlayers[0]?.user_id || null; // Fallback para o primeiro jogador
    const nextIndex = (currentIndex + 1) % sortedPlayers.length;
    return sortedPlayers[nextIndex]?.user_id || null;
};

export const calculateNewBoardState = (
    currentBoardState: any,
    piece: StandardPieceFormat,
    side: 'left' | 'right'
) => {
    const newPieceEntry = { piece: piece, orientation: piece.top === piece.bottom ? 'vertical' : 'horizontal' };
    
    if (!currentBoardState || !currentBoardState.pieces || currentBoardState.pieces.length === 0) {
        return {
            pieces: [newPieceEntry],
            left_end: piece.top,
            right_end: piece.bottom
        };
    }
    
    const newPieces = side === 'left' 
      ? [newPieceEntry, ...currentBoardState.pieces]
      : [...currentBoardState.pieces, newPieceEntry];
      
    let newLeftEnd = currentBoardState.left_end;
    let newRightEnd = currentBoardState.right_end;
    
    if (side === 'left') {
        newLeftEnd = currentBoardState.left_end === piece.top ? piece.bottom : piece.top;
    } else { // right
        newRightEnd = currentBoardState.right_end === piece.top ? piece.bottom : piece.top;
    }
    
    return {
        pieces: newPieces,
        left_end: newLeftEnd,
        right_end: newRightEnd
    };
};

export const removePieceFromHand = (hand: any[], piece: StandardPieceFormat) => {
    let found = false;
    return hand.filter((p: any) => {
        if (found) return true;
        const standardP = standardizePieceFormat(p);
        const isMatch = (standardP.top === piece.top && standardP.bottom === piece.bottom) || 
                        (standardP.top === piece.bottom && standardP.bottom === piece.top);
        if (isMatch) {
            found = true;
            return false;
        }
        return true;
    });
};
