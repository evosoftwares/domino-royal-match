
import React, { useRef, useEffect } from 'react';
import { DominoPieceType } from '@/types/game';
import DominoPiece from '../DominoPiece';
import { cn } from '@/lib/utils';
import { useBoardLayout } from '@/hooks/useBoardLayout';
import { ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react';
import '../../styles/domino-connections.css';

interface LinearGameBoardProps {
  placedPieces: DominoPieceType[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  className?: string;
  showControls?: boolean;
  autoScroll?: 'left' | 'right' | 'center' | false;
}

const LinearGameBoard: React.FC<LinearGameBoardProps> = ({
  placedPieces,
  onDrop,
  onDragOver,
  className,
  showControls = true,
  autoScroll = 'center'
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const {
    layout,
    boardEnds,
    validation,
    scrollX,
    scrollTo,
    scrollToEnd,
    scrollToCenter,
    debugInfo
  } = useBoardLayout({
    pieces: placedPieces,
    containerWidth: 800,
    autoScroll
  });

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollX;
    }
  }, [scrollX]);

  const handleDrop = (e: React.DragEvent) => {
    console.log('🎯 Linear board drop event triggered');
    e.preventDefault();
    onDrop(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(e);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollX = e.currentTarget.scrollLeft;
    scrollTo(newScrollX);
  };

  // Função para renderizar informações das extremidades com spinners
  const renderBoardEndsInfo = () => {
    const { leftEnd, rightEnd, topEnds, bottomEnds } = boardEnds;
    
    return (
      <div className="flex items-center gap-4">
        <div className="text-green-200 text-sm">
          <span className="font-semibold">Extremidades principais:</span>
          <span className="ml-2 px-3 py-1 bg-red-500/20 rounded-full text-red-200 font-mono">
            {leftEnd ?? '?'}
          </span>
          <span className="mx-2 text-green-400">←→</span>
          <span className="px-3 py-1 bg-blue-500/20 rounded-full text-blue-200 font-mono">
            {rightEnd ?? '?'}
          </span>
        </div>
        
        {(topEnds.length > 0 || bottomEnds.length > 0) && (
          <div className="text-yellow-200 text-xs">
            <span className="font-semibold">Spinners:</span>
            {topEnds.map((end, idx) => (
              <span key={`top-${idx}`} className="ml-1 px-2 py-1 bg-yellow-500/20 rounded text-yellow-200">
                ↑{end.value}
              </span>
            ))}
            {bottomEnds.map((end, idx) => (
              <span key={`bottom-${idx}`} className="ml-1 px-2 py-1 bg-yellow-500/20 rounded text-yellow-200">
                ↓{end.value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col justify-center items-center w-full", className)}>
      <div className={cn(
        "w-full max-w-7xl min-h-[400px]",
        "bg-gradient-to-br from-green-800/10 to-green-900/20",
        "rounded-2xl border-2 border-green-600/20 backdrop-blur-sm",
        "shadow-xl"
      )}>
        
        {/* Header com informações das extremidades */}
        {showControls && (
          <div className="flex justify-between items-center p-4 border-b border-green-600/20">
            {renderBoardEndsInfo()}
            
            {!validation.isValid && (
              <div className="flex items-center gap-1 text-red-400 text-xs">
                <Zap className="w-3 h-3" />
                <span>{validation.errors.length} erro(s) de conexão</span>
              </div>
            )}
            
            {/* Controles de navegação */}
            {layout.needsScroll && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToEnd('left')}
                  className="p-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-200 transition-colors"
                  title="Ir para início"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={scrollToCenter}
                  className="p-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-200 transition-colors"
                  title="Centralizar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollToEnd('right')}
                  className="p-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-200 transition-colors"
                  title="Ir para fim"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Área principal do tabuleiro */}
        <div className="p-6">
          <div 
            className={cn(
              "w-full rounded-xl transition-all duration-300",
              "flex items-center justify-center",
              placedPieces.length === 0 
                ? "min-h-[300px]" 
                : "min-h-[200px]"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onScroll={handleScroll}
            ref={scrollContainerRef}
            data-testid="linear-game-board"
          >
            {placedPieces.length === 0 ? (
              <div className="text-center text-green-200 bg-green-800/20 p-8 rounded-xl border-2 border-dashed border-green-400/50">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-xl font-semibold mb-2">Arraste a primeira peça aqui</p>
                <p className="text-sm opacity-75">O jogo começará com sua jogada</p>
                <div className="mt-4 text-xs text-green-300">
                  <p className="font-semibold">Regras do Layout:</p>
                  <p>• Corrente única e contínua</p>
                  <p>• Peças duplas ficam cruzadas (transversais)</p>
                  <p>• Peças duplas funcionam como "spinners"</p>
                </div>
              </div>
            ) : (
              <div className="domino-board w-full">
                <div className="domino-sequence">
                  {placedPieces.map((piece, index) => {
                    // REGRA 4: Peças duplas ficam transversais (cruzadas)
                    const isDupla = piece.top === piece.bottom && piece.top > 0;
                    
                    // Orientação baseada nas regras do dominó
                    const orientation: 'vertical' | 'horizontal' = isDupla ? 'vertical' : 'horizontal';
                    
                    return (
                      <DominoPiece 
                        key={`${piece.id}-${index}`}
                        topValue={piece.top} 
                        bottomValue={piece.bottom} 
                        isPlayable={false} 
                        className={cn(
                          "transition-all duration-200",
                          isDupla && "dupla spinner", // Classe especial para peças duplas (spinners)
                          "domino-piece-in-sequence"
                        )} 
                        orientation={orientation}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Debug info com validação das regras */}
        {process.env.NODE_ENV === 'development' && showControls && (
          <div className="p-3 border-t border-green-600/20 bg-black/20 rounded-b-xl">
            <div className="text-xs text-green-200 space-y-1">
              <div className="font-bold text-green-400">🎯 Mesa de Dominó - Regras Aplicadas</div>
              <div className="flex flex-wrap gap-4">
                <span>Peças: {debugInfo.totalPieces}</span>
                <span>Corrente única: {debugInfo.isSequenceValid ? '✅ Válida' : '❌ Inválida'}</span>
                <span className="font-mono">Extremidades: {boardEnds.leftEnd} ↔ {boardEnds.rightEnd}</span>
                {(boardEnds.topEnds.length > 0 || boardEnds.bottomEnds.length > 0) && (
                  <span className="text-yellow-200">
                    Spinners ativos: {boardEnds.topEnds.length + boardEnds.bottomEnds.length}
                  </span>
                )}
              </div>
              {!debugInfo.isSequenceValid && (
                <div className="text-red-300 text-xs">
                  Erros: {debugInfo.validationErrors.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinearGameBoard;
