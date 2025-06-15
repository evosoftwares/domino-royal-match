
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DominoPieceType } from '@/types/game';
import { calculateLinearLayout, LayoutDimensions, LinearLayout, calculateOptimalScroll } from '@/utils/boardLayoutLogic';
import { calculateBoardEnds, validateBoardSequence, BoardEnds } from '@/utils/pieceConnectionLogic';

interface UseBoardLayoutProps {
  pieces: DominoPieceType[];
  containerWidth?: number;
  dimensions?: Partial<LayoutDimensions>;
  autoScroll?: 'left' | 'right' | 'center' | false;
}

export const useBoardLayout = ({
  pieces,
  containerWidth = 800,
  dimensions,
  autoScroll = 'center'
}: UseBoardLayoutProps) => {
  const [scrollX, setScrollX] = useState(0);
  const [isLayoutAnimating, setIsLayoutAnimating] = useState(false);

  // Memoizar dimensões completas
  const fullDimensions: LayoutDimensions = useMemo(() => ({
    pieceWidth: 64,
    pieceHeight: 32,
    spacing: 8,
    maxPiecesPerRow: 5,
    ...dimensions
  }), [containerWidth, dimensions]);

  // Calcular layout das peças
  const layout = useMemo(() => {
    console.log('🎯 Calculando layout para', pieces.length, 'peças');
    return calculateLinearLayout(pieces, containerWidth, fullDimensions);
  }, [pieces, containerWidth, fullDimensions]);

  // Calcular extremidades do tabuleiro
  const boardEnds = useMemo(() => {
    return calculateBoardEnds(pieces);
  }, [pieces]);

  // Validar sequência de peças
  const validation = useMemo(() => {
    return validateBoardSequence(pieces);
  }, [pieces]);

  // Auto-scroll quando layout muda
  useEffect(() => {
    if (autoScroll && layout.needsScroll) {
      const optimalScroll = calculateOptimalScroll(layout, containerWidth, autoScroll);
      setScrollX(optimalScroll);
    }
  }, [layout, containerWidth, autoScroll]);

  // Funções de controle de scroll
  const scrollTo = useCallback((x: number) => {
    const maxScroll = Math.max(0, layout.totalWidth - containerWidth);
    const newScrollX = Math.max(0, Math.min(x, maxScroll));
    setScrollX(newScrollX);
  }, [layout.totalWidth, containerWidth]);

  const scrollToEnd = useCallback((end: 'left' | 'right') => {
    if (end === 'left') {
      scrollTo(0);
    } else {
      scrollTo(layout.totalWidth - containerWidth);
    }
  }, [layout.totalWidth, containerWidth, scrollTo]);

  const scrollToCenter = useCallback(() => {
    const center = (layout.totalWidth - containerWidth) / 2;
    scrollTo(center);
  }, [layout.totalWidth, containerWidth, scrollTo]);

  // Informações de debug
  const debugInfo = useMemo(() => ({
    totalPieces: pieces.length,
    layoutRows: layout.rows.length,
    totalWidth: layout.totalWidth,
    totalHeight: layout.totalHeight,
    needsScroll: layout.needsScroll,
    scrollX,
    boardEnds,
    validationErrors: validation.errors,
    isSequenceValid: validation.isValid
  }), [pieces.length, layout, scrollX, boardEnds, validation]);

  return {
    // Layout data
    layout,
    boardEnds,
    validation,
    
    // Scroll controls
    scrollX,
    scrollTo,
    scrollToEnd,
    scrollToCenter,
    
    // State
    isLayoutAnimating,
    setIsLayoutAnimating,
    
    // Debug
    debugInfo
  };
};
