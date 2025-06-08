
export interface DominoPieceType {
  id: string;
  top: number;
  bottom: number;
  originalFormat?: { l: number; r: number };
}

export const generateDominoPieces = (): DominoPieceType[] => {
  const pieces: DominoPieceType[] = [];
  
  for (let top = 0; top <= 6; top++) {
    for (let bottom = top; bottom <= 6; bottom++) {
      pieces.push({
        id: `${top}-${bottom}`,
        top,
        bottom,
        originalFormat: { l: top, r: bottom }
      });
    }
  }
  
  return pieces;
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const distributePieces = (allPieces: DominoPieceType[]) => {
  const shuffledPieces = shuffleArray(allPieces);
  
  return {
    player1: shuffledPieces.slice(0, 6),
    player2: shuffledPieces.slice(6, 12),
    player3: shuffledPieces.slice(12, 18),
    player4: shuffledPieces.slice(18, 24),
    remaining: shuffledPieces.slice(24, 28) // 4 peças sobram
  };
};

export const getPieceValue = (piece: DominoPieceType): number => {
  return piece.top + piece.bottom;
};

export const canPieceConnect = (piece: DominoPieceType, openEnds: number[]): boolean => {
  return openEnds.some(end => piece.top === end || piece.bottom === end);
};

export const getNewOpenEnds = (
  piece: DominoPieceType, 
  currentOpenEnds: number[], 
  connectionEnd: number
): number[] => {
  const newEnds = [...currentOpenEnds];
  const connectionIndex = newEnds.indexOf(connectionEnd);
  
  if (connectionIndex !== -1) {
    // Remove a extremidade conectada e adiciona a nova extremidade aberta
    newEnds[connectionIndex] = piece.top === connectionEnd ? piece.bottom : piece.top;
  }
  
  return newEnds;
};
