
import { useMemo, useRef } from 'react';
import { DominoPieceType } from '@/types/game';
import { standardizePiece, canPieceConnect, extractBoardEnds } from '@/utils/pieceValidation';

interface ValidationCacheEntry {
  result: boolean;
  timestamp: number;
  boardHash: string;
}

interface PieceValidationCache {
  canPiecePlay: (piece: DominoPieceType, boardState: any) => boolean;
  clearCache: () => void;
  getCacheStats: () => { hits: number; misses: number; size: number };
}

export const usePieceValidationCache = (): PieceValidationCache => {
  const cacheRef = useRef<Map<string, ValidationCacheEntry>>(new Map());
  const statsRef = useRef({ hits: 0, misses: 0 });

  const createPieceKey = (piece: DominoPieceType): string => {
    // Usa valores padronizados diretamente para maior consistência
    return `${piece.top}-${piece.bottom}`;
  };

  const createBoardHash = (boardState: any): string => {
    if (!boardState?.pieces || boardState.pieces.length === 0) {
      return 'empty';
    }
    
    const ends = extractBoardEnds(boardState);
    return `${ends.left || 'null'}-${ends.right || 'null'}-${boardState.pieces.length}`;
  };

  const canPiecePlay = useMemo(() => (piece: DominoPieceType, boardState: any): boolean => {
    const pieceKey = createPieceKey(piece);
    const boardHash = createBoardHash(boardState);
    const cacheKey = `${pieceKey}:${boardHash}`;

    // Verificar cache
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < 30000) { // Cache válido por 30s
      statsRef.current.hits++;
      return cached.result;
    }

    // Cache miss - calcular resultado usando peça já padronizada
    statsRef.current.misses++;
    
    try {
      // Como DominoPieceType já está padronizado, usamos diretamente
      const standardPiece = { top: piece.top, bottom: piece.bottom };
      const boardEnds = extractBoardEnds(boardState);
      const result = canPieceConnect(standardPiece, boardEnds);
      
      // Armazenar no cache
      cacheRef.current.set(cacheKey, {
        result,
        timestamp: now,
        boardHash
      });

      // Limpar entradas antigas para evitar vazamento de memória
      if (cacheRef.current.size > 100) {
        const cutoff = now - 60000; // Remover entradas mais antigas que 1 minuto
        for (const [key, entry] of cacheRef.current.entries()) {
          if (entry.timestamp < cutoff) {
            cacheRef.current.delete(key);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Erro na validação de peça:', error);
      return false;
    }
  }, []);

  const clearCache = useMemo(() => () => {
    cacheRef.current.clear();
    statsRef.current = { hits: 0, misses: 0 };
  }, []);

  const getCacheStats = useMemo(() => () => ({
    hits: statsRef.current.hits,
    misses: statsRef.current.misses,
    size: cacheRef.current.size
  }), []);

  return {
    canPiecePlay,
    clearCache,
    getCacheStats
  };
};
