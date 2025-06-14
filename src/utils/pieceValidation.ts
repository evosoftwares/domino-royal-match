
import { DominoPieceType, StandardPieceFormat, BackendPieceFormat, BoardEnds, ValidationResult } from '@/types/game';

// Cache para conversões já realizadas
const conversionCache = new Map<string, StandardPieceFormat>();
const CACHE_SIZE_LIMIT = 200;

// Função para criar chave de cache
const createCacheKey = (piece: any): string => {
  if (typeof piece === 'object' && piece !== null) {
    // Diferentes formatos possíveis
    if ('l' in piece && 'r' in piece) return `l${piece.l}r${piece.r}`;
    if ('left' in piece && 'right' in piece) return `left${piece.left}right${piece.right}`;
    if ('top' in piece && 'bottom' in piece) return `top${piece.top}bottom${piece.bottom}`;
  }
  if (Array.isArray(piece) && piece.length === 2) {
    return `arr${piece[0]}${piece[1]}`;
  }
  return JSON.stringify(piece);
};

// Limpa o cache quando necessário
const cleanCache = () => {
  if (conversionCache.size > CACHE_SIZE_LIMIT) {
    const keysToDelete = Array.from(conversionCache.keys()).slice(0, 50);
    keysToDelete.forEach(key => conversionCache.delete(key));
  }
};

// Padroniza o formato de uma peça para {top, bottom} - FUNÇÃO PRINCIPAL
export const standardizePiece = (piece: any): StandardPieceFormat => {
  if (!piece) {
    throw new Error('Peça não fornecida');
  }

  // Verifica cache primeiro
  const cacheKey = createCacheKey(piece);
  const cached = conversionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let result: StandardPieceFormat;

  try {
    if (typeof piece === 'object' && piece !== null) {
      // Formato backend {l, r} -> {top, bottom}
      if (typeof piece.l === 'number' && typeof piece.r === 'number') {
        result = { top: piece.l, bottom: piece.r };
      }
      // Formato {left, right} -> {top, bottom}
      else if (typeof piece.left === 'number' && typeof piece.right === 'number') {
        result = { top: piece.left, bottom: piece.right };
      }
      // Formato já padronizado {top, bottom}
      else if (typeof piece.top === 'number' && typeof piece.bottom === 'number') {
        result = { top: piece.top, bottom: piece.bottom };
      }
      // Fallback para objetos com propriedades numéricas
      else {
        const values = Object.values(piece).filter(v => typeof v === 'number') as number[];
        if (values.length >= 2) {
          result = { top: values[0], bottom: values[1] };
          console.warn('Formato de peça não reconhecido, usando fallback:', piece);
        } else {
          throw new Error(`Objeto de peça não possui propriedades numéricas válidas: ${JSON.stringify(piece)}`);
        }
      }
    }
    // Formato array [top, bottom]
    else if (Array.isArray(piece) && piece.length >= 2) {
      const [first, second] = piece;
      if (typeof first === 'number' && typeof second === 'number') {
        result = { top: first, bottom: second };
      } else {
        throw new Error(`Array de peça contém valores não numéricos: ${JSON.stringify(piece)}`);
      }
    }
    else {
      throw new Error(`Formato de peça não suportado: ${typeof piece} - ${JSON.stringify(piece)}`);
    }

    // Validação dos valores
    if (!Number.isInteger(result.top) || !Number.isInteger(result.bottom) ||
        result.top < 0 || result.top > 6 || result.bottom < 0 || result.bottom > 6) {
      throw new Error(`Valores de peça inválidos: top=${result.top}, bottom=${result.bottom}`);
    }

    // Armazena no cache
    conversionCache.set(cacheKey, result);
    cleanCache();

    return result;
  } catch (error) {
    console.error('Erro na padronização de peça:', { piece, error: error.message });
    throw error;
  }
};

// Converte peça padronizada para o formato do backend
export const toBackendFormat = (piece: StandardPieceFormat): BackendPieceFormat => {
  return { l: piece.top, r: piece.bottom };
};

// Converte peça padronizada para DominoPieceType completo
export const toDominoPieceType = (piece: any, id?: string): DominoPieceType => {
  const standard = standardizePiece(piece);
  return {
    id: id || `piece-${standard.top}-${standard.bottom}-${Date.now()}`,
    top: standard.top,
    bottom: standard.bottom,
    originalFormat: piece
  };
};

// Verifica se duas peças são iguais (independente do formato)
export const arePiecesEqual = (piece1: any, piece2: any): boolean => {
  try {
    const std1 = standardizePiece(piece1);
    const std2 = standardizePiece(piece2);
    
    // Peças iguais ou invertidas são consideradas iguais
    return (std1.top === std2.top && std1.bottom === std2.bottom) ||
           (std1.top === std2.bottom && std1.bottom === std2.top);
  } catch {
    return false;
  }
};

// Verifica se uma peça pode ser conectada às extremidades do tabuleiro
export const canPieceConnect = (piece: StandardPieceFormat, boardEnds: BoardEnds): boolean => {
  // Se o tabuleiro está vazio, qualquer peça pode ser jogada
  if (boardEnds.left === null && boardEnds.right === null) {
    return true;
  }
  
  // Verifica se a peça pode conectar com alguma extremidade
  const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
  
  return canConnectLeft || canConnectRight;
};

// Determina o lado onde a peça deve ser jogada
export const determineSide = (piece: StandardPieceFormat, boardEnds: BoardEnds): 'left' | 'right' | null => {
  // Se o tabuleiro está vazio, joga na esquerda por convenção
  if (boardEnds.left === null && boardEnds.right === null) {
    return 'left';
  }
  
  // Verifica possibilidades de conexão
  const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
  const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
  
  // Se pode conectar em ambos os lados, prioriza a esquerda
  if (canConnectLeft && canConnectRight) {
    return 'left';
  }
  
  if (canConnectLeft) return 'left';
  if (canConnectRight) return 'right';
  
  return null;
};

// Extrai as extremidades do estado do tabuleiro de forma robusta
export const extractBoardEnds = (boardState: any): BoardEnds => {
  if (!boardState || !boardState.pieces || !Array.isArray(boardState.pieces) || boardState.pieces.length === 0) {
    return { left: null, right: null };
  }
  
  // Prioriza extremidades explícitas se disponíveis
  if (typeof boardState.left_end === 'number' && typeof boardState.right_end === 'number') {
    return {
      left: boardState.left_end,
      right: boardState.right_end
    };
  }
  
  // Fallback: calcula extremidades a partir das peças
  try {
    const pieces = boardState.pieces;
    const firstPiece = standardizePiece(pieces[0]?.piece || pieces[0]);
    const lastPiece = standardizePiece(pieces[pieces.length - 1]?.piece || pieces[pieces.length - 1]);
    
    return {
      left: firstPiece.top,
      right: lastPiece.bottom
    };
  } catch (error) {
    console.error('Erro ao extrair extremidades do tabuleiro:', error);
    return { left: null, right: null };
  }
};

// Valida se uma jogada é legal - FUNÇÃO PRINCIPAL DE VALIDAÇÃO
export const validateMove = (
  piece: any, 
  boardState: any, 
  side?: 'left' | 'right'
): ValidationResult => {
  try {
    const standardPiece = standardizePiece(piece);
    const boardEnds = extractBoardEnds(boardState);
    
    console.log('Validando jogada:', { 
      piece: standardPiece, 
      boardEnds, 
      requestedSide: side 
    });
    
    // Verifica se a peça pode ser conectada
    if (!canPieceConnect(standardPiece, boardEnds)) {
      return {
        isValid: false,
        error: `Peça [${standardPiece.top}|${standardPiece.bottom}] não pode ser conectada às extremidades [${boardEnds.left}|${boardEnds.right}]`
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
    console.error('Erro na validação da jogada:', error);
    return {
      isValid: false,
      error: error.message || 'Erro na validação da jogada'
    };
  }
};

// Função utilitária para limpar cache manualmente
export const clearValidationCache = (): void => {
  conversionCache.clear();
};

// Função utilitária para obter estatísticas do cache
export const getCacheStats = () => ({
  size: conversionCache.size,
  keys: Array.from(conversionCache.keys()).slice(0, 10) // Primeiras 10 chaves para debug
});
