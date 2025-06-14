
import { toast } from 'sonner';

// Tipos padronizados de erro
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  GAME_STATE = 'game_state',
  PIECE_FORMAT = 'piece_format',
  SUPABASE = 'supabase',
  UNKNOWN = 'unknown'
}

export interface GameError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
  context?: string;
}

// Sistema centralizado de tratamento de erros
class ErrorHandler {
  private errorLog: GameError[] = [];
  private readonly MAX_LOG_SIZE = 50;

  // Criação padronizada de erros
  createError(
    type: ErrorType, 
    message: string, 
    details?: any, 
    context?: string
  ): GameError {
    const error: GameError = {
      type,
      message,
      details,
      timestamp: Date.now(),
      context
    };

    this.logError(error);
    return error;
  }

  // Tratamento específico por tipo de erro
  handleError(error: GameError, showToast: boolean = true): void {
    console.group(`🚨 Erro ${error.type.toUpperCase()}`);
    console.error('Mensagem:', error.message);
    console.error('Contexto:', error.context);
    console.error('Detalhes:', error.details);
    console.error('Timestamp:', new Date(error.timestamp).toISOString());
    console.groupEnd();

    if (showToast) {
      this.showErrorToast(error);
    }
  }

  // Toast padronizado por tipo de erro
  private showErrorToast(error: GameError): void {
    const messages = {
      [ErrorType.NETWORK]: 'Erro de conexão. Tente novamente.',
      [ErrorType.VALIDATION]: 'Dados inválidos. Verifique a jogada.',
      [ErrorType.GAME_STATE]: 'Estado do jogo inconsistente.',
      [ErrorType.PIECE_FORMAT]: 'Formato de peça inválido.',
      [ErrorType.SUPABASE]: 'Erro no servidor. Tente novamente.',
      [ErrorType.UNKNOWN]: 'Erro inesperado.'
    };

    const userMessage = messages[error.type] || error.message;
    toast.error(userMessage);
  }

  // Log de erros
  private logError(error: GameError): void {
    this.errorLog.push(error);
    
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(-this.MAX_LOG_SIZE);
    }
  }

  // Análise de padrões de erro
  getErrorStats(): { 
    total: number; 
    byType: Record<ErrorType, number>; 
    recent: GameError[] 
  } {
    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = this.errorLog.filter(e => e.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    return {
      total: this.errorLog.length,
      byType,
      recent: this.errorLog.slice(-10)
    };
  }

  // Limpeza do log
  clearLog(): void {
    this.errorLog = [];
    console.log('🧹 Log de erros limpo');
  }
}

// Instância global
export const errorHandler = new ErrorHandler();

// Utilitários para diferentes tipos de erro
export const handleNetworkError = (error: any, context?: string): GameError => {
  return errorHandler.createError(
    ErrorType.NETWORK,
    'Falha na comunicação com o servidor',
    error,
    context
  );
};

export const handleValidationError = (message: string, details?: any): GameError => {
  return errorHandler.createError(
    ErrorType.VALIDATION,
    message,
    details,
    'validation'
  );
};

export const handleGameStateError = (message: string, state?: any): GameError => {
  return errorHandler.createError(
    ErrorType.GAME_STATE,
    message,
    state,
    'game_state'
  );
};

export const handlePieceFormatError = (piece: any, expectedFormat?: string): GameError => {
  return errorHandler.createError(
    ErrorType.PIECE_FORMAT,
    `Formato de peça inválido: ${expectedFormat || 'formato padrão esperado'}`,
    piece,
    'piece_format'
  );
};

export const handleSupabaseError = (error: any, operation?: string): GameError => {
  return errorHandler.createError(
    ErrorType.SUPABASE,
    `Erro do Supabase${operation ? ` em ${operation}` : ''}`,
    error,
    'supabase'
  );
};

// Hook para usar o error handler
export const useErrorHandler = () => {
  return {
    handleError: (error: GameError, showToast = true) => errorHandler.handleError(error, showToast),
    createError: errorHandler.createError.bind(errorHandler),
    getStats: errorHandler.getErrorStats.bind(errorHandler),
    clearLog: errorHandler.clearLog.bind(errorHandler),
    // Utilitários
    handleNetworkError,
    handleValidationError,
    handleGameStateError,
    handlePieceFormatError,
    handleSupabaseError
  };
};
