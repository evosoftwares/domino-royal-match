import { DominoPieceType } from '@/types/game';

export interface StandardPieceFormat {
  left: number;
  right: number;
}

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

// Padroniza o formato de uma peça para {left, right}
export const standardizePiece = (piece: any): StandardPieceFormat => {
  if (piece && typeof piece === 'object') {
    // Formato {l, r}
    if ('l' in piece && 'r' in piece) {
      return { left: piece.l, right: piece.r };
    }
    // Formato {left, right}
    if ('left' in piece && 'right' in piece) {
      return { left: piece.left, right: piece.right };
    }
    // Formato {top, bottom}
    if ('top' in piece && 'bottom' in piece) {
      return { left: piece.top, right: piece.bottom };
    }
  }
  
  // Formato array [left, right]
  if (Array.isArray(piece) && piece.length === 2) {
    return { left: piece[0], right: piece[1] };
  }
  
  throw new Error(`Formato de peça inválido: ${JSON.stringify(piece)}`);
};

// Converte peça padronizada para o formato do backend
export const toBackendFormat = (piece: StandardPieceFormat) => {
  return { l: piece.left, r: piece.right };
};

// Verifica se uma peça pode ser conectada às extremidades do tabuleiro
export const canPieceConnect = (piece: StandardPieceFormat, boardEnds: BoardEnds): boolean => {
  console.log('Verificando conectividade:', { piece, boardEnds });
  
  // Se o tabuleiro está vazio, qualquer peça pode ser jogada
  if (boardEnds.left === null && boardEnds.right === null) {
    return true;
  }
  
  // Verifica se a peça pode conectar com alguma extremidade
  const canConnectLeft = boardEnds.left !== null && (piece.left === boardEnds.left || piece.right === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.left === boardEnds.right || piece.right === boardEnds.right);
  
  return canConnectLeft || canConnectRight;
};

// Determina o lado onde a peça deve ser jogada
export const determineSide = (piece: StandardPieceFormat, boardEnds: BoardEnds): 'left' | 'right' | null => {
  console.log('Determinando lado:', { piece, boardEnds });
  
  // Se o tabuleiro está vazio, joga na esquerda por convenção
  if (boardEnds.left === null && boardEnds.right === null) {
    return 'left';
  }
  
  // Verifica possibilidades de conexão
  const canConnectLeft = boardEnds.left !== null && (piece.left === boardEnds.left || piece.right === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.left === boardEnds.right || piece.right === boardEnds.right);
  
  // Se pode conectar em ambos os lados, prioriza a esquerda
  if (canConnectLeft && canConnectRight) {
    return 'left';
  }
  
  if (canConnectLeft) return 'left';
  if (canConnectRight) return 'right';
  
  return null;
};

// Extrai as extremidades do estado do tabuleiro
export const extractBoardEnds = (boardState: any): BoardEnds => {
  if (!boardState || !boardState.pieces || boardState.pieces.length === 0) {
    return { left: null, right: null };
  }
  
  return {
    left: boardState.left_end ?? null,
    right: boardState.right_end ?? null
  };
};

// Valida se uma jogada é legal
export const validateMove = (
  piece: any, 
  boardState: any, 
  side?: 'left' | 'right'
): { isValid: boolean; error?: string; side?: 'left' | 'right' } => {
  try {
    const standardPiece = standardizePiece(piece);
    const boardEnds = extractBoardEnds(boardState);
    
    console.log('Validando jogada:', { standardPiece, boardEnds, requestedSide: side });
    
    // Verifica se a peça pode ser conectada
    if (!canPieceConnect(standardPiece, boardEnds)) {
      return {
        isValid: false,
        error: 'Esta peça não pode ser conectada às extremidades do tabuleiro'
      };
    }
    
    // Determina o lado se não foi especificado
    const determinedSide = side || determineSide(standardPiece, boardEnds);
    
    if (!determinedSide) {
      return {
        isValid: false,
        error: 'Não foi possível determinar onde jogar esta peça'
      };
    }
    
    return {
      isValid: true,
      side: determinedSide
    };
    
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Erro na validação da jogada'
    };
  }
};
