
import { DominoPieceType } from '@/types/game';
import { PieceConnection, calculateAllConnections } from './pieceConnectionLogic';

export interface LayoutDimensions {
  pieceWidth: number;
  pieceHeight: number;
  spacing: number;
  maxPiecesPerRow: number;
}

export interface LayoutRow {
  pieces: PieceConnection[];
  width: number;
  yOffset: number;
}

export interface LinearLayout {
  rows: LayoutRow[];
  totalWidth: number;
  totalHeight: number;
  needsScroll: boolean;
}

const DEFAULT_DIMENSIONS: LayoutDimensions = {
  pieceWidth: 64,  
  pieceHeight: 32, 
  spacing: 8,      
  maxPiecesPerRow: 5 
};

/**
 * Calcula o layout das peças em múltiplas linhas com conexões corretas
 */
export const calculateLinearLayout = (
  pieces: DominoPieceType[],
  containerWidth: number = 800,
  dimensions: LayoutDimensions = DEFAULT_DIMENSIONS
): LinearLayout => {
  if (pieces.length === 0) {
    return {
      rows: [],
      totalWidth: 0,
      totalHeight: 0,
      needsScroll: false
    };
  }

  const connections = calculateAllConnections(pieces);
  const rows: LayoutRow[] = [];
  
  // Dividir as peças em linhas de acordo com maxPiecesPerRow
  for (let i = 0; i < connections.length; i += dimensions.maxPiecesPerRow) {
    const rowPieces = connections.slice(i, i + dimensions.maxPiecesPerRow);
    const rowIndex = Math.floor(i / dimensions.maxPiecesPerRow);
    
    let rowWidth = 0;
    
    // Calcular posições das peças na linha considerando orientação
    rowPieces.forEach((connection, index) => {
      const pieceWidth = connection.orientation === 'horizontal' ? dimensions.pieceWidth : dimensions.pieceHeight;
      
      connection.position = {
        x: rowWidth,
        y: rowIndex * (Math.max(dimensions.pieceHeight, dimensions.pieceWidth) + dimensions.spacing)
      };
      
      rowWidth += pieceWidth + (index < rowPieces.length - 1 ? dimensions.spacing : 0);
    });
    
    rows.push({
      pieces: rowPieces,
      width: rowWidth,
      yOffset: rowIndex * (Math.max(dimensions.pieceHeight, dimensions.pieceWidth) + dimensions.spacing)
    });
  }

  const totalWidth = Math.max(...rows.map(row => row.width), containerWidth * 0.8);
  const totalHeight = rows.length > 0 ? 
    rows[rows.length - 1].yOffset + Math.max(dimensions.pieceHeight, dimensions.pieceWidth) : 0;

  return {
    rows,
    totalWidth,
    totalHeight,
    needsScroll: totalWidth > containerWidth
  };
};

/**
 * Calcula a posição de scroll ideal
 */
export const calculateOptimalScroll = (
  layout: LinearLayout,
  containerWidth: number,
  focusOn: 'left' | 'right' | 'center' = 'center'
): number => {
  if (!layout.needsScroll) return 0;

  switch (focusOn) {
    case 'left':
      return 0;
    case 'right':
      return Math.max(0, layout.totalWidth - containerWidth);
    case 'center':
    default:
      return Math.max(0, (layout.totalWidth - containerWidth) / 2);
  }
};

/**
 * Encontra a peça em uma posição específica
 */
export const findPieceAtPosition = (
  layout: LinearLayout,
  x: number,
  y: number,
  dimensions: LayoutDimensions = DEFAULT_DIMENSIONS
): PieceConnection | null => {
  for (const row of layout.rows) {
    if (y >= row.yOffset && y <= row.yOffset + Math.max(dimensions.pieceHeight, dimensions.pieceWidth)) {
      for (const piece of row.pieces) {
        const pieceWidth = piece.orientation === 'horizontal' ? dimensions.pieceWidth : dimensions.pieceHeight;
        
        if (x >= piece.position.x && x <= piece.position.x + pieceWidth) {
          return piece;
        }
      }
    }
  }
  return null;
};

/**
 * Calcula as extremidades visíveis no viewport atual
 */
export const getVisibleEnds = (
  layout: LinearLayout,
  scrollX: number,
  containerWidth: number
): {
  leftVisible: boolean;
  rightVisible: boolean;
  leftEnd: number | null;
  rightEnd: number | null;
} => {
  if (layout.rows.length === 0) {
    return { leftVisible: false, rightVisible: false, leftEnd: null, rightEnd: null };
  }

  const firstRow = layout.rows[0];
  const lastRow = layout.rows[layout.rows.length - 1];
  
  const leftmostPiece = firstRow.pieces[0];
  const rightmostPiece = lastRow.pieces[lastRow.pieces.length - 1];
  
  const leftVisible = leftmostPiece.position.x >= scrollX;
  const rightVisible = rightmostPiece.position.x <= scrollX + containerWidth;

  return {
    leftVisible,
    rightVisible,
    leftEnd: leftmostPiece.leftConnection,
    rightEnd: rightmostPiece.rightConnection
  };
};
