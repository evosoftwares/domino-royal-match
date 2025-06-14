
import { DominoPieceType } from '@/types/game';

// Interface unificada para todos os formatos de peças
export interface UniversalPiece {
  top: number;
  bottom: number;
  id?: string;
  originalFormat?: any;
}

// Formato do backend
export interface BackendPiece {
  l: number;
  r: number;
}

// Formato alternativo
export interface AlternatePiece {
  left: number;
  right: number;
}

/**
 * Conversor universal de formatos de peças
 * Centraliza toda a lógica de conversão em um local
 */
export class PieceFormatConverter {
  
  /**
   * Converte qualquer formato para o formato universal
   */
  static toUniversal(piece: any): UniversalPiece {
    if (!piece) {
      throw new Error('Piece is null or undefined');
    }

    // Já está no formato universal
    if (typeof piece.top === 'number' && typeof piece.bottom === 'number') {
      return {
        top: piece.top,
        bottom: piece.bottom,
        id: piece.id,
        originalFormat: piece
      };
    }

    // Formato backend {l, r}
    if (typeof piece.l === 'number' && typeof piece.r === 'number') {
      return {
        top: piece.l,
        bottom: piece.r,
        originalFormat: piece
      };
    }

    // Formato alternativo {left, right}
    if (typeof piece.left === 'number' && typeof piece.right === 'number') {
      return {
        top: piece.left,
        bottom: piece.right,
        originalFormat: piece
      };
    }

    // Formato array [top, bottom]
    if (Array.isArray(piece) && piece.length >= 2) {
      const [first, second] = piece;
      if (typeof first === 'number' && typeof second === 'number') {
        return {
          top: first,
          bottom: second,
          originalFormat: piece
        };
      }
    }

    // Tentativa de fallback - pegar os primeiros dois números
    const values = Object.values(piece).filter(v => typeof v === 'number') as number[];
    if (values.length >= 2) {
      console.warn('⚠️ Using fallback conversion for piece:', piece);
      return {
        top: values[0],
        bottom: values[1],
        originalFormat: piece
      };
    }

    throw new Error(`Unsupported piece format: ${JSON.stringify(piece)}`);
  }

  /**
   * Converte para formato do backend
   */
  static toBackend(piece: any): BackendPiece {
    const universal = this.toUniversal(piece);
    return {
      l: universal.top,
      r: universal.bottom
    };
  }

  /**
   * Converte para DominoPieceType
   */
  static toDominoPiece(piece: any, id?: string): DominoPieceType {
    const universal = this.toUniversal(piece);
    return {
      id: id || universal.id || `piece-${universal.top}-${universal.bottom}-${Date.now()}`,
      top: universal.top,
      bottom: universal.bottom,
      originalFormat: universal.originalFormat
    };
  }

  /**
   * Valida se uma peça tem valores válidos (0-6)
   */
  static validatePieceValues(piece: any): boolean {
    try {
      const universal = this.toUniversal(piece);
      return Number.isInteger(universal.top) && 
             Number.isInteger(universal.bottom) &&
             universal.top >= 0 && universal.top <= 6 &&
             universal.bottom >= 0 && universal.bottom <= 6;
    } catch {
      return false;
    }
  }

  /**
   * Compara duas peças independente do formato
   */
  static areEqual(piece1: any, piece2: any): boolean {
    try {
      const p1 = this.toUniversal(piece1);
      const p2 = this.toUniversal(piece2);
      
      return (p1.top === p2.top && p1.bottom === p2.bottom) ||
             (p1.top === p2.bottom && p1.bottom === p2.top);
    } catch {
      return false;
    }
  }

  /**
   * Converte uma lista de peças para formato universal
   */
  static convertHandToUniversal(hand: any[]): UniversalPiece[] {
    return hand.map((piece, index) => {
      try {
        return this.toUniversal(piece);
      } catch (error) {
        console.error(`Error converting piece at index ${index}:`, piece, error);
        return null;
      }
    }).filter(Boolean) as UniversalPiece[];
  }

  /**
   * Converte uma lista de peças para formato do backend
   */
  static convertHandToBackend(hand: any[]): BackendPiece[] {
    return hand.map((piece, index) => {
      try {
        return this.toBackend(piece);
      } catch (error) {
        console.error(`Error converting piece at index ${index}:`, piece, error);
        return null;
      }
    }).filter(Boolean) as BackendPiece[];
  }
}

// Funções de conveniência para compatibilidade
export const toBackendFormat = (piece: any) => PieceFormatConverter.toBackend(piece);
export const toUniversalFormat = (piece: any) => PieceFormatConverter.toUniversal(piece);
export const arePiecesEqual = (piece1: any, piece2: any) => PieceFormatConverter.areEqual(piece1, piece2);
