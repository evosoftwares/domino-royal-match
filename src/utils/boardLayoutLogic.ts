
import { DominoPieceType } from '@/types/game';
import { PieceConnection, calculateAllConnections } from './pieceConnectionLogic';

export interface LayoutDimensions {
  pieceWidth: number;
  pieceHeight: number;
  spacing: number;
  maxRowWidth: number;
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
  pieceWidth: 64,  // 16 * 4 (w-16)
  pieceHeight: 32, // 8 * 4 (h-8)
  spacing: 8,      // gap-2
  maxRowWidth: 800 // Largura máxima antes de quebrar linha
};

/**
 * Calcula o layout linear das peças com quebra de linha inteligente
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
  let currentRow: PieceConnection[] = [];
  let currentRowWidth = 0;
  let yOffset = 0;

  for (const connection of connections) {
    const pieceWidth = connection.orientation === 'horizontal' ? dimensions.pieceWidth : dimensions.pieceHeight;
    const pieceHeight = connection.orientation === 'horizontal' ? dimensions.pieceHeight : dimensions.pieceWidth;
    
    // Verificar se a peça cabe na linha atual
    const newWidth = currentRowWidth + pieceWidth + (currentRow.length > 0 ? dimensions.spacing : 0);
    
    if (newWidth > containerWidth && currentRow.length > 0) {
      // Quebrar linha
      rows.push({
        pieces: [...currentRow],
        width: currentRowWidth,
        yOffset
      });
      
      // Começar nova linha
      currentRow = [connection];
      currentRowWidth = pieceWidth;
      yOffset += Math.max(dimensions.pieceHeight, dimensions.pieceWidth) + dimensions.spacing;
    } else {
      // Adicionar à linha atual
      currentRow.push(connection);
      currentRowWidth = newWidth;
    }
    
    // Atualizar posição da peça
    connection.position = {
      x: currentRowWidth - pieceWidth,
      y: yOffset
    };
  }

  // Adicionar última linha se houver peças
  if (currentRow.length > 0) {
    rows.push({
      pieces: currentRow,
      width: currentRowWidth,
      yOffset
    });
  }

  const totalWidth = Math.max(...rows.map(row => row.width));
  const totalHeight = yOffset + Math.max(dimensions.pieceHeight, dimensions.pieceWidth);

  return {
    rows,
    totalWidth,
    totalHeight,
    needsScroll: totalWidth > containerWidth
  };
};

/**
 * Calcula a posição de scroll ideal para mostrar as extremidades
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

/**
 * Gera dados para animação de transição
 */
export const generateLayoutTransition = (
  oldLayout: LinearLayout,
  newLayout: LinearLayout
): Array<{
  pieceId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}> => {
  const transitions: Array<{
    pieceId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }> = [];

  // Mapear peças antigas para novas posições
  const oldPieces = oldLayout.rows.flatMap(row => row.pieces);
  const newPieces = newLayout.rows.flatMap(row => row.pieces);

  for (const oldPiece of oldPieces) {
    const newPiece = newPieces.find(p => p.piece.id === oldPiece.piece.id);
    if (newPiece) {
      transitions.push({
        pieceId: oldPiece.piece.id,
        from: oldPiece.position,
        to: newPiece.position
      });
    }
  }

  return transitions;
};
