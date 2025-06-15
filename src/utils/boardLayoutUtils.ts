
import { DominoPieceType } from '@/types/game';

export const chunkPiecesIntoColumns = (pieces: DominoPieceType[], piecesPerColumn: number = 5) => {
  const chunks: DominoPieceType[][] = [];
  
  for (let i = 0; i < pieces.length; i += piecesPerColumn) {
    chunks.push(pieces.slice(i, i + piecesPerColumn));
  }
  
  return chunks;
};

export const findPiecePosition = (pieces: DominoPieceType[], targetPiece: DominoPieceType, piecesPerColumn: number = 5) => {
  const pieceIndex = pieces.findIndex(p => p.id === targetPiece.id);
  if (pieceIndex === -1) return null;
  
  const columnIndex = Math.floor(pieceIndex / piecesPerColumn);
  const positionInColumn = pieceIndex % piecesPerColumn;
  
  return { columnIndex, positionInColumn, isFirstPiece: pieceIndex === 0, isLastPiece: pieceIndex === pieces.length - 1 };
};
