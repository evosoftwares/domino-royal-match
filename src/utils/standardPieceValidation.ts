
import { DominoPieceType, StandardPieceFormat, BoardEnds, ValidationResult } from '@/types/game';
import { gameCache, createPieceValidationKey } from './gameCache';
import { handlePieceFormatError, handleValidationError, errorHandler } from './errorHandler';

// Padronização DEFINITIVA de formato de peças
export const standardizePieceFormat = (piece: any): StandardPieceFormat => {
  if (!piece) {
    const error = handlePieceFormatError(piece, '{top, bottom}');
    errorHandler.handleError(error);
    throw new Error(error.message);
  }

  try {
    // Formato já padronizado {top, bottom}
    if (typeof piece.top === 'number' && typeof piece.bottom === 'number') {
      return validatePieceValues({ top: piece.top, bottom: piece.bottom });
    }
    
    // Formato backend {l, r}
    if (typeof piece.l === 'number' && typeof piece.r === 'number') {
      return validatePieceValues({ top: piece.l, bottom: piece.r });
    }
    
    // Formato {left, right}
    if (typeof piece.left === 'number' && typeof piece.right === 'number') {
      return validatePieceValues({ top: piece.left, bottom: piece.right });
    }
    
    // Formato array [top, bottom]
    if (Array.isArray(piece) && piece.length >= 2) {
      const [first, second] = piece;
      if (typeof first === 'number' && typeof second === 'number') {
        return validatePieceValues({ top: first, bottom: second });
      }
    }

    // Fallback para objetos com propriedades numéricas
    const values = Object.values(piece).filter(v => typeof v === 'number') as number[];
    if (values.length >= 2) {
      console.warn('⚠️ Formato de peça não reconhecido, usando fallback:', piece);
      return validatePieceValues({ top: values[0], bottom: values[1] });
    }

    throw new Error(`Formato não suportado: ${JSON.stringify(piece)}`);
  } catch (error: any) {
    const gameError = handlePieceFormatError(piece, '{top: number, bottom: number}');
    errorHandler.handleError(gameError);
    throw error;
  }
};

// Validação de valores de peças
const validatePieceValues = (piece: StandardPieceFormat): StandardPieceFormat => {
  if (!Number.isInteger(piece.top) || !Number.isInteger(piece.bottom) ||
      piece.top < 0 || piece.top > 6 || piece.bottom < 0 || piece.bottom > 6) {
    const error = handleValidationError(
      `Valores de peça inválidos: top=${piece.top}, bottom=${piece.bottom}`
    );
    errorHandler.handleError(error);
    throw new Error(error.message);
  }
  return piece;
};

// Conversão para DominoPieceType padronizado
export const createStandardDominoPiece = (piece: any, id?: string): DominoPieceType => {
  const standard = standardizePieceFormat(piece);
  return {
    id: id || `piece-${standard.top}-${standard.bottom}-${Date.now()}`,
    top: standard.top,
    bottom: standard.bottom,
    originalFormat: piece
  };
};

// Extração padronizada de extremidades do tabuleiro
export const extractBoardEnds = (boardState: any): BoardEnds => {
  if (!boardState || !boardState.pieces || !Array.isArray(boardState.pieces) || boardState.pieces.length === 0) {
    return { left: null, right: null };
  }
  
  try {
    // Prioriza extremidades explícitas
    if (typeof boardState.left_end === 'number' && typeof boardState.right_end === 'number') {
      return {
        left: boardState.left_end,
        right: boardState.right_end
      };
    }
    
    // Calcula extremidades a partir das peças
    const pieces = boardState.pieces;
    const firstPiece = standardizePieceFormat(pieces[0]?.piece || pieces[0]);
    const lastPiece = standardizePieceFormat(pieces[pieces.length - 1]?.piece || pieces[pieces.length - 1]);
    
    return {
      left: firstPiece.top,
      right: lastPiece.bottom
    };
  } catch (error: any) {
    const gameError = handleValidationError('Erro ao extrair extremidades do tabuleiro', error);
    errorHandler.handleError(gameError);
    return { left: null, right: null };
  }
};

// Validação de conexão com cache
export const canPieceConnect = (piece: StandardPieceFormat, boardEnds: BoardEnds): boolean => {
  // Tabuleiro vazio
  if (boardEnds.left === null && boardEnds.right === null) {
    return true;
  }
  
  // Criar chave de cache
  const boardHash = `${boardEnds.left || 'null'}-${boardEnds.right || 'null'}`;
  const cacheKey = createPieceValidationKey({ 
    id: 'temp', 
    top: piece.top, 
    bottom: piece.bottom 
  }, boardHash);
  
  // Verificar cache
  const cached = gameCache.getPieceValidation(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  // Calcular resultado
  const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
  const result = canConnectLeft || canConnectRight;
  
  // Armazenar no cache
  gameCache.setPieceValidation(cacheKey, result);
  
  return result;
};

// Validação completa de movimento
export const validateMove = (piece: any, boardState: any, side?: 'left' | 'right'): ValidationResult => {
  try {
    const standardPiece = standardizePieceFormat(piece);
    const boardEnds = extractBoardEnds(boardState);
    
    if (!canPieceConnect(standardPiece, boardEnds)) {
      return {
        isValid: false,
        error: `Peça [${standardPiece.top}|${standardPiece.bottom}] não pode conectar com [${boardEnds.left}|${boardEnds.right}]`
      };
    }
    
    // Determinar lado se não especificado
    const determinedSide = side || determineBestSide(standardPiece, boardEnds);
    
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
    const gameError = handleValidationError('Erro na validação da jogada', error);
    errorHandler.handleError(gameError);
    return {
      isValid: false,
      error: gameError.message
    };
  }
};

// Determinação inteligente do lado
const determineBestSide = (piece: StandardPieceFormat, boardEnds: BoardEnds): 'left' | 'right' | null => {
  if (boardEnds.left === null && boardEnds.right === null) {
    return 'left'; // Convenção para tabuleiro vazio
  }
  
  const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
  
  // Prioriza esquerda se ambos são possíveis
  if (canConnectLeft && canConnectRight) return 'left';
  if (canConnectLeft) return 'left';
  if (canConnectRight) return 'right';
  
  return null;
};

// Comparação padronizada de peças
export const arePiecesEqual = (piece1: any, piece2: any): boolean => {
  try {
    const std1 = standardizePieceFormat(piece1);
    const std2 = standardizePieceFormat(piece2);
    
    return (std1.top === std2.top && std1.bottom === std2.bottom) ||
           (std1.top === std2.bottom && std1.bottom === std2.top);
  } catch {
    return false;
  }
};

// Conversão para formato backend
export const toBackendFormat = (piece: StandardPieceFormat) => ({
  l: piece.top,
  r: piece.bottom
});
