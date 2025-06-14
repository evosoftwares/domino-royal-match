
import { DominoPieceType } from '@/types/game';

// Interface unificada mais robusta
export interface UniversalPiece {
  top: number;
  bottom: number;
  id?: string;
  isValid: boolean;
  metadata?: {
    originalFormat: any;
    convertedAt: number;
    source: string;
  };
}

// Formatos suportados
export interface BackendPiece {
  l: number;
  r: number;
}

export interface AlternatePiece {
  left: number;
  right: number;
}

export interface ArrayPiece extends Array<number> {
  0: number;
  1: number;
}

/**
 * Conversor universal robusto com cache e validação avançada
 */
export class UniversalPieceConverter {
  private static cache = new Map<string, UniversalPiece>();
  private static readonly CACHE_TTL = 300000; // 5 minutos
  
  /**
   * Converte qualquer formato para o formato universal com cache
   */
  static toUniversal(piece: any, source = 'unknown'): UniversalPiece {
    if (!piece) {
      throw new Error('Piece is null or undefined');
    }

    // Gerar chave de cache
    const cacheKey = JSON.stringify(piece) + source;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.metadata!.convertedAt < this.CACHE_TTL) {
      return cached;
    }

    const result = this.convertPiece(piece, source);
    
    // Armazenar no cache
    this.cache.set(cacheKey, result);
    
    // Limpar cache antigo periodicamente
    if (this.cache.size > 1000) {
      this.cleanCache();
    }
    
    return result;
  }

  private static convertPiece(piece: any, source: string): UniversalPiece {
    let top: number, bottom: number;

    // Formato já padronizado {top, bottom}
    if (this.isStandardFormat(piece)) {
      top = piece.top;
      bottom = piece.bottom;
    }
    // Formato backend {l, r}
    else if (this.isBackendFormat(piece)) {
      top = piece.l;
      bottom = piece.r;
    }
    // Formato alternativo {left, right}
    else if (this.isAlternateFormat(piece)) {
      top = piece.left;
      bottom = piece.right;
    }
    // Formato array [top, bottom]
    else if (this.isArrayFormat(piece)) {
      top = piece[0];
      bottom = piece[1];
    }
    // Fallback para objetos com propriedades numéricas
    else {
      const values = this.extractNumericValues(piece);
      if (values.length >= 2) {
        console.warn('⚠️ Using fallback conversion for piece:', piece);
        top = values[0];
        bottom = values[1];
      } else {
        throw new Error(`Unsupported piece format: ${JSON.stringify(piece)}`);
      }
    }

    const isValid = this.validatePieceValues(top, bottom);
    
    return {
      top,
      bottom,
      id: piece.id || `piece-${top}-${bottom}-${Date.now()}`,
      isValid,
      metadata: {
        originalFormat: piece,
        convertedAt: Date.now(),
        source
      }
    };
  }

  // Type guards para identificar formatos
  private static isStandardFormat(piece: any): piece is { top: number; bottom: number } {
    return typeof piece.top === 'number' && typeof piece.bottom === 'number';
  }

  private static isBackendFormat(piece: any): piece is BackendPiece {
    return typeof piece.l === 'number' && typeof piece.r === 'number';
  }

  private static isAlternateFormat(piece: any): piece is AlternatePiece {
    return typeof piece.left === 'number' && typeof piece.right === 'number';
  }

  private static isArrayFormat(piece: any): piece is ArrayPiece {
    return Array.isArray(piece) && piece.length >= 2 && 
           typeof piece[0] === 'number' && typeof piece[1] === 'number';
  }

  private static extractNumericValues(piece: any): number[] {
    return Object.values(piece).filter(v => typeof v === 'number') as number[];
  }

  private static validatePieceValues(top: number, bottom: number): boolean {
    return Number.isInteger(top) && Number.isInteger(bottom) &&
           top >= 0 && top <= 6 && bottom >= 0 && bottom <= 6;
  }

  /**
   * Converte para formato do backend
   */
  static toBackend(piece: any): BackendPiece {
    const universal = this.toUniversal(piece, 'backend-conversion');
    if (!universal.isValid) {
      throw new Error(`Invalid piece values: [${universal.top}|${universal.bottom}]`);
    }
    return { l: universal.top, r: universal.bottom };
  }

  /**
   * Converte para DominoPieceType
   */
  static toDominoPiece(piece: any, id?: string): DominoPieceType {
    const universal = this.toUniversal(piece, 'domino-conversion');
    if (!universal.isValid) {
      throw new Error(`Invalid piece values: [${universal.top}|${universal.bottom}]`);
    }
    
    return {
      id: id || universal.id!,
      top: universal.top,
      bottom: universal.bottom,
      originalFormat: universal.metadata?.originalFormat
    };
  }

  /**
   * Converte lista de peças em lote
   */
  static convertBatch(pieces: any[], targetFormat: 'universal' | 'backend' | 'domino' = 'universal'): any[] {
    return pieces.map((piece, index) => {
      try {
        switch (targetFormat) {
          case 'backend':
            return this.toBackend(piece);
          case 'domino':
            return this.toDominoPiece(piece);
          default:
            return this.toUniversal(piece, `batch-${index}`);
        }
      } catch (error) {
        console.error(`Error converting piece at index ${index}:`, piece, error);
        return null;
      }
    }).filter(Boolean);
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
   * Limpa cache antigo
   */
  private static cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.metadata!.convertedAt > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Estatísticas do cache
   */
  static getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()).slice(0, 10) // Primeiras 10 entradas
    };
  }
}

// Funções de conveniência para compatibilidade
export const toBackendFormat = (piece: any) => UniversalPieceConverter.toBackend(piece);
export const toUniversalFormat = (piece: any) => UniversalPieceConverter.toUniversal(piece);
export const arePiecesEqual = (piece1: any, piece2: any) => UniversalPieceConverter.areEqual(piece1, piece2);
export const convertBatch = (pieces: any[], format: 'universal' | 'backend' | 'domino' = 'universal') => 
  UniversalPieceConverter.convertBatch(pieces, format);
