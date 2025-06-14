
import { DominoPieceType, GameData, PlayerData } from '@/types/game';

// Sistema de cache centralizado e unificado
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface GameCacheStats {
  pieceValidations: { hits: number; misses: number; size: number };
  playerProcessing: { hits: number; misses: number; size: number };
  boardStates: { hits: number; misses: number; size: number };
  totalMemoryUsage: number;
}

class GameCacheManager {
  private pieceValidationCache = new Map<string, CacheEntry<boolean>>();
  private playerProcessingCache = new Map<string, CacheEntry<DominoPieceType[]>>();
  private boardStateCache = new Map<string, CacheEntry<any>>();
  
  private readonly CACHE_EXPIRY_MS = 30000; // 30 segundos
  private readonly MAX_CACHE_SIZE = 100;

  // Cache de validação de peças
  getPieceValidation(key: string): boolean | null {
    const entry = this.pieceValidationCache.get(key);
    if (entry && this.isValidEntry(entry)) {
      entry.hits++;
      return entry.data;
    }
    return null;
  }

  setPieceValidation(key: string, isValid: boolean): void {
    this.pieceValidationCache.set(key, {
      data: isValid,
      timestamp: Date.now(),
      hits: 0
    });
    this.cleanupCache(this.pieceValidationCache);
  }

  // Cache de processamento de jogadores
  getPlayerPieces(key: string): DominoPieceType[] | null {
    const entry = this.playerProcessingCache.get(key);
    if (entry && this.isValidEntry(entry)) {
      entry.hits++;
      return entry.data;
    }
    return null;
  }

  setPlayerPieces(key: string, pieces: DominoPieceType[]): void {
    this.playerProcessingCache.set(key, {
      data: pieces,
      timestamp: Date.now(),
      hits: 0
    });
    this.cleanupCache(this.playerProcessingCache);
  }

  // Cache de estado do tabuleiro
  getBoardState(key: string): any | null {
    const entry = this.boardStateCache.get(key);
    if (entry && this.isValidEntry(entry)) {
      entry.hits++;
      return entry.data;
    }
    return null;
  }

  setBoardState(key: string, state: any): void {
    this.boardStateCache.set(key, {
      data: state,
      timestamp: Date.now(),
      hits: 0
    });
    this.cleanupCache(this.boardStateCache);
  }

  // Validação de entrada do cache
  private isValidEntry<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.CACHE_EXPIRY_MS;
  }

  // Limpeza automática do cache
  private cleanupCache<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size <= this.MAX_CACHE_SIZE) return;

    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Remove entradas expiradas primeiro
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > this.CACHE_EXPIRY_MS) {
        entriesToDelete.push(key);
      }
    }

    // Se ainda estiver cheio, remove entradas menos usadas
    if (cache.size - entriesToDelete.length > this.MAX_CACHE_SIZE) {
      const entriesByHits = Array.from(cache.entries())
        .sort(([,a], [,b]) => a.hits - b.hits)
        .slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.3))
        .map(([key]) => key);
      
      entriesToDelete.push(...entriesByHits);
    }

    entriesToDelete.forEach(key => cache.delete(key));
  }

  // Estatísticas do cache
  getStats(): GameCacheStats {
    const pieceStats = this.getCacheStats(this.pieceValidationCache);
    const playerStats = this.getCacheStats(this.playerProcessingCache);
    const boardStats = this.getCacheStats(this.boardStateCache);

    return {
      pieceValidations: pieceStats,
      playerProcessing: playerStats,
      boardStates: boardStats,
      totalMemoryUsage: pieceStats.size + playerStats.size + boardStats.size
    };
  }

  private getCacheStats<T>(cache: Map<string, CacheEntry<T>>) {
    const entries = Array.from(cache.values());
    const hits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const total = hits + entries.length; // Approximation
    
    return {
      hits,
      misses: Math.max(0, total - hits),
      size: cache.size
    };
  }

  // Limpeza completa
  clearAll(): void {
    this.pieceValidationCache.clear();
    this.playerProcessingCache.clear();
    this.boardStateCache.clear();
    console.log('🧹 Cache global limpo');
  }

  // Otimização automática
  optimize(): void {
    this.cleanupCache(this.pieceValidationCache);
    this.cleanupCache(this.playerProcessingCache);
    this.cleanupCache(this.boardStateCache);
    console.log('🔧 Cache otimizado automaticamente');
  }
}

// Instância global do cache
export const gameCache = new GameCacheManager();

// Funções utilitárias para criação de chaves de cache
export const createPieceValidationKey = (piece: DominoPieceType, boardHash: string): string => {
  return `${piece.top}-${piece.bottom}:${boardHash}`;
};

export const createPlayerPiecesKey = (playerId: string, handHash: string): string => {
  return `${playerId}:${handHash}`;
};

export const createBoardStateKey = (gameId: string, version: number): string => {
  return `${gameId}:${version}`;
};

// Hash para arrays de peças
export const createHandHash = (hand: any[]): string => {
  if (!Array.isArray(hand)) return 'invalid';
  return `${hand.length}-${hand.map((p, i) => `${i}:${JSON.stringify(p)}`).join('|')}`;
};
