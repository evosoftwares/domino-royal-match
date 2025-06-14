
import { DominoPieceType, StandardPieceFormat, BoardEnds, ValidationResult } from '@/types/game';
import { UniversalPieceConverter } from './universalPieceConverter';
import { gameCache, createPieceValidationKey } from './gameCache';
import { handlePieceFormatError, handleValidationError, errorHandler } from './errorHandler';

interface ValidationContext {
  gameId: string;
  playerId: string;
  moveType: 'play' | 'pass';
  timestamp: number;
}

interface EnhancedValidationResult extends ValidationResult {
  context?: ValidationContext;
  suggestions?: string[];
  confidence: number;
}

/**
 * Sistema de validação aprimorado com contexto e sugestões
 */
export class EnhancedPieceValidator {
  
  /**
   * Padronização usando o novo conversor universal
   */
  static standardizePieceFormat(piece: any): StandardPieceFormat {
    try {
      const universal = UniversalPieceConverter.toUniversal(piece, 'validation');
      if (!universal.isValid) {
        throw new Error(`Invalid piece values: [${universal.top}|${universal.bottom}]`);
      }
      return { top: universal.top, bottom: universal.bottom };
    } catch (error: any) {
      const gameError = handlePieceFormatError(piece, '{top: number, bottom: number}');
      errorHandler.handleError(gameError);
      throw error;
    }
  }

  /**
   * Validação de movimento com contexto aprimorado
   */
  static validateMoveWithContext(
    piece: any, 
    boardState: any, 
    context: ValidationContext,
    side?: 'left' | 'right'
  ): EnhancedValidationResult {
    try {
      const standardPiece = this.standardizePieceFormat(piece);
      const boardEnds = this.extractBoardEnds(boardState);
      
      // Validação básica de conexão
      const canConnect = this.canPieceConnect(standardPiece, boardEnds);
      
      if (!canConnect.isValid) {
        return {
          isValid: false,
          error: canConnect.error,
          context,
          suggestions: this.generateSuggestions(standardPiece, boardEnds),
          confidence: 0.95
        };
      }
      
      // Determinar lado otimizado
      const determinedSide = side || this.determineBestSide(standardPiece, boardEnds);
      
      if (!determinedSide) {
        return {
          isValid: false,
          error: 'Não foi possível determinar onde jogar esta peça',
          context,
          suggestions: ['Verifique as extremidades do tabuleiro'],
          confidence: 0.8
        };
      }
      
      return {
        isValid: true,
        side: determinedSide,
        context,
        confidence: 1.0
      };
      
    } catch (error: any) {
      const gameError = handleValidationError('Erro na validação da jogada', error);
      errorHandler.handleError(gameError);
      return {
        isValid: false,
        error: gameError.message,
        context,
        confidence: 0.0
      };
    }
  }

  /**
   * Extração melhorada de extremidades do tabuleiro
   */
  static extractBoardEnds(boardState: any): BoardEnds {
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
      
      // Calcula extremidades usando o conversor universal
      const pieces = boardState.pieces;
      const firstPiece = UniversalPieceConverter.toUniversal(pieces[0]?.piece || pieces[0], 'board-analysis');
      const lastPiece = UniversalPieceConverter.toUniversal(pieces[pieces.length - 1]?.piece || pieces[pieces.length - 1], 'board-analysis');
      
      return {
        left: firstPiece.top,
        right: lastPiece.bottom
      };
    } catch (error: any) {
      const gameError = handleValidationError('Erro ao extrair extremidades do tabuleiro', error);
      errorHandler.handleError(gameError);
      return { left: null, right: null };
    }
  }

  /**
   * Validação aprimorada de conexão com cache
   */
  static canPieceConnect(piece: StandardPieceFormat, boardEnds: BoardEnds): { isValid: boolean; error?: string } {
    // Tabuleiro vazio
    if (boardEnds.left === null && boardEnds.right === null) {
      return { isValid: true };
    }
    
    // Verificar cache
    const boardHash = `${boardEnds.left || 'null'}-${boardEnds.right || 'null'}`;
    const cacheKey = createPieceValidationKey({ 
      id: 'temp', 
      top: piece.top, 
      bottom: piece.bottom 
    }, boardHash);
    
    const cached = gameCache.getPieceValidation(cacheKey);
    if (cached !== null) {
      return { isValid: cached };
    }
    
    // Validar conexões
    const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
    const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
    const result = canConnectLeft || canConnectRight;
    
    // Armazenar no cache
    gameCache.setPieceValidation(cacheKey, result);
    
    if (!result) {
      return {
        isValid: false,
        error: `Peça [${piece.top}|${piece.bottom}] não pode conectar com extremidades [${boardEnds.left}|${boardEnds.right}]`
      };
    }
    
    return { isValid: true };
  }

  /**
   * Determinação inteligente do lado com preferências
   */
  private static determineBestSide(piece: StandardPieceFormat, boardEnds: BoardEnds): 'left' | 'right' | null {
    if (boardEnds.left === null && boardEnds.right === null) {
      return 'left'; // Convenção para tabuleiro vazio
    }
    
    const canConnectLeft = boardEnds.left !== null && (piece.top === boardEnds.left || piece.bottom === boardEnds.left);
    const canConnectRight = boardEnds.right !== null && (piece.top === boardEnds.right || piece.bottom === boardEnds.right);
    
    // Se ambos são possíveis, priorizar lado com menor número para balanceamento
    if (canConnectLeft && canConnectRight) {
      return (boardEnds.left! <= boardEnds.right!) ? 'left' : 'right';
    }
    
    if (canConnectLeft) return 'left';
    if (canConnectRight) return 'right';
    
    return null;
  }

  /**
   * Gerar sugestões inteligentes para o jogador
   */
  private static generateSuggestions(piece: StandardPieceFormat, boardEnds: BoardEnds): string[] {
    const suggestions: string[] = [];
    
    if (boardEnds.left === null && boardEnds.right === null) {
      suggestions.push('Esta é a primeira peça - pode ser jogada em qualquer lugar');
      return suggestions;
    }
    
    const { left, right } = boardEnds;
    
    suggestions.push(`Extremidades disponíveis: ${left} (esquerda) e ${right} (direita)`);
    suggestions.push(`Sua peça: [${piece.top}|${piece.bottom}]`);
    
    // Sugestões específicas
    if (piece.top === left || piece.bottom === left) {
      suggestions.push(`✓ Pode conectar na extremidade esquerda (${left})`);
    }
    if (piece.top === right || piece.bottom === right) {
      suggestions.push(`✓ Pode conectar na extremidade direita (${right})`);
    }
    
    if (suggestions.length === 2) { // Apenas as duas primeiras (extremidades + sua peça)
      suggestions.push('❌ Esta peça não pode ser jogada no momento');
      suggestions.push('💡 Tente passar o turno ou escolha outra peça');
    }
    
    return suggestions;
  }

  /**
   * Criar DominoPieceType padronizado
   */
  static createStandardDominoPiece(piece: any, id?: string): DominoPieceType {
    return UniversalPieceConverter.toDominoPiece(piece, id);
  }

  /**
   * Comparação padronizada de peças
   */
  static arePiecesEqual(piece1: any, piece2: any): boolean {
    return UniversalPieceConverter.areEqual(piece1, piece2);
  }

  /**
   * Conversão para formato backend
   */
  static toBackendFormat(piece: StandardPieceFormat) {
    return UniversalPieceConverter.toBackend(piece);
  }
}

// Funções de conveniência para compatibilidade
export const standardizePieceFormat = (piece: any) => EnhancedPieceValidator.standardizePieceFormat(piece);
export const validateMove = (piece: any, boardState: any, side?: 'left' | 'right') => {
  const context: ValidationContext = {
    gameId: 'unknown',
    playerId: 'unknown',
    moveType: 'play',
    timestamp: Date.now()
  };
  return EnhancedPieceValidator.validateMoveWithContext(piece, boardState, context, side);
};
export const createStandardDominoPiece = (piece: any, id?: string) => EnhancedPieceValidator.createStandardDominoPiece(piece, id);
export const extractBoardEnds = (boardState: any) => EnhancedPieceValidator.extractBoardEnds(boardState);
export const canPieceConnect = (piece: StandardPieceFormat, boardEnds: BoardEnds) => EnhancedPieceValidator.canPieceConnect(piece, boardEnds);
export const arePiecesEqual = (piece1: any, piece2: any) => EnhancedPieceValidator.arePiecesEqual(piece1, piece2);
export const toBackendFormat = (piece: StandardPieceFormat) => EnhancedPieceValidator.toBackendFormat(piece);
