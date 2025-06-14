
import { useCallback, useRef, useMemo } from 'react';
import { DominoPieceType } from '@/types/game';

interface PerformanceMetrics {
  pieceValidations: number;
  cacheHits: number;
  cacheMisses: number;
  averageValidationTime: number;
  totalValidationTime: number;
}

export const useGamePerformanceOptimizer = () => {
  const metricsRef = useRef<PerformanceMetrics>({
    pieceValidations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageValidationTime: 0,
    totalValidationTime: 0
  });

  const validationTimesRef = useRef<number[]>([]);

  const measureValidation = useCallback(<T>(operation: () => T, operationName: string): T => {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Atualizar métricas
      metricsRef.current.pieceValidations++;
      metricsRef.current.totalValidationTime += duration;
      validationTimesRef.current.push(duration);
      
      // Manter apenas as últimas 100 medições
      if (validationTimesRef.current.length > 100) {
        validationTimesRef.current = validationTimesRef.current.slice(-100);
      }
      
      // Calcular média
      metricsRef.current.averageValidationTime = 
        validationTimesRef.current.reduce((a, b) => a + b, 0) / validationTimesRef.current.length;

      // Log performance se for muito lenta
      if (duration > 10) {
        console.warn(`⚠️ Operação lenta detectada: ${operationName} levou ${duration.toFixed(2)}ms`);
      } else if (duration > 5) {
        console.log(`⏱️ ${operationName}: ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.error(`❌ Erro em ${operationName} após ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, []);

  const optimizePieceArray = useCallback((pieces: DominoPieceType[]): DominoPieceType[] => {
    return measureValidation(() => {
      // Remover duplicatas baseado em top/bottom (considerando simetria)
      const uniquePieces = pieces.filter((piece, index, arr) => {
        return !arr.slice(0, index).some(existingPiece => 
          (piece.top === existingPiece.top && piece.bottom === existingPiece.bottom) ||
          (piece.top === existingPiece.bottom && piece.bottom === existingPiece.top)
        );
      });

      if (uniquePieces.length !== pieces.length) {
        console.log(`🔧 Otimização: removidas ${pieces.length - uniquePieces.length} peças duplicadas`);
      }

      return uniquePieces;
    }, 'optimizePieceArray');
  }, [measureValidation]);

  const getPerformanceReport = useCallback(() => {
    const metrics = metricsRef.current;
    const report = {
      ...metrics,
      cacheEfficiency: metrics.pieceValidations > 0 
        ? (metrics.cacheHits / metrics.pieceValidations) * 100 
        : 0,
      recommendations: [] as string[]
    };

    // Gerar recomendações baseadas nas métricas
    if (report.averageValidationTime > 5) {
      report.recommendations.push('Considere otimizar validações de peças - tempo médio alto');
    }
    
    if (report.cacheEfficiency < 50 && metrics.pieceValidations > 10) {
      report.recommendations.push('Eficiência do cache baixa - considere revisar estratégia de cache');
    }

    if (metrics.pieceValidations > 1000) {
      report.recommendations.push('Alto número de validações - considere batch processing');
    }

    console.group('📊 Relatório de Performance');
    console.log('Validações de peças:', metrics.pieceValidations);
    console.log('Tempo médio por validação:', `${metrics.averageValidationTime.toFixed(2)}ms`);
    console.log('Tempo total gasto:', `${metrics.totalValidationTime.toFixed(2)}ms`);
    console.log('Eficiência do cache:', `${report.cacheEfficiency.toFixed(1)}%`);
    if (report.recommendations.length > 0) {
      console.log('Recomendações:', report.recommendations);
    }
    console.groupEnd();

    return report;
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      pieceValidations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0,
      totalValidationTime: 0
    };
    validationTimesRef.current = [];
    console.log('📊 Métricas de performance resetadas');
  }, []);

  // Memoização para evitar recriação desnecessária
  const memoizedUtils = useMemo(() => ({
    measureValidation,
    optimizePieceArray,
    getPerformanceReport,
    resetMetrics
  }), [measureValidation, optimizePieceArray, getPerformanceReport, resetMetrics]);

  return memoizedUtils;
};
