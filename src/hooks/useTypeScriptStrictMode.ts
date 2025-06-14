
import { useCallback, useRef } from 'react';
import { DominoPieceType } from '@/types/game';
import {
  convertFromStrictPiece,
  convertToStrictBoardState,
  convertToStrictGameState,
  convertToStrictPiece,
  convertToStrictPieces,
  convertToStrictPlayerState,
  convertToStrictPlayersState,
} from '@/utils/strict-mode/converters';
import { validateStateConsistency as validateStateConsistencyFn } from '@/utils/strict-mode/validator';
import {
  StrictBoardState,
  StrictGameState,
  StrictPieceFormat,
  StrictPlayerState,
  ValidationCache,
} from '@/utils/strict-mode/types';

/**
 * Hook para integração TypeScript strict mode com validação em tempo de compilação
 */
export const useTypeScriptStrictMode = () => {
  const validationCache = useRef<ValidationCache>({});

  const toStrictPiece = useCallback((piece: any): StrictPieceFormat => {
    return convertToStrictPiece(piece, validationCache.current);
  }, []);

  const toStrictPieces = useCallback((pieces: any[]): ReadonlyArray<StrictPieceFormat> => {
    return convertToStrictPieces(pieces, validationCache.current);
  }, []);

  const toStrictBoardState = useCallback((boardState: any): StrictBoardState | null => {
    return convertToStrictBoardState(boardState, validationCache.current);
  }, []);

  const toStrictGameState = useCallback((gameData: any): StrictGameState => {
    return convertToStrictGameState(gameData, validationCache.current);
  }, []);

  const toStrictPlayerState = useCallback((playerData: any): StrictPlayerState => {
    return convertToStrictPlayerState(playerData, validationCache.current);
  }, []);

  const toStrictPlayersState = useCallback((playersData: any[]): ReadonlyArray<StrictPlayerState> => {
    return convertToStrictPlayersState(playersData, validationCache.current);
  }, []);

  const validateStateConsistency = useCallback(
    (gameState: StrictGameState, playersState: ReadonlyArray<StrictPlayerState>): void => {
      validateStateConsistencyFn(gameState, playersState);
    },
    []
  );

  const fromStrictPiece = useCallback((strictPiece: StrictPieceFormat): DominoPieceType => {
    return convertFromStrictPiece(strictPiece);
  }, []);

  const clearValidationCache = useCallback(() => {
    validationCache.current = {};
  }, []);

  const getCacheStats = useCallback(() => {
    return {
      size: Object.keys(validationCache.current).length,
      entries: Object.keys(validationCache.current)
        .slice(0, 10),
    };
  }, []);

  return {
    toStrictPiece,
    toStrictPieces,
    toStrictBoardState,
    toStrictGameState,
    toStrictPlayerState,
    toStrictPlayersState,
    validateStateConsistency,
    fromStrictPiece,
    clearValidationCache,
    getCacheStats,
  };
};

// Types exportados para uso em outros arquivos
export type {
  StrictPieceFormat,
  StrictGameState,
  StrictBoardState,
  StrictPlayerState,
} from '@/utils/strict-mode/types';
