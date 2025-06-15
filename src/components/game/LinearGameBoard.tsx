
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

  return (
    <div className={cn("flex flex-col justify-center", className)}>
      <div className={cn(
        "w-full max-w-5xl min-h-[400px]",
        "bg-gradient-to-br from-green-800/30 to-green-900/30",
        "rounded-3xl border-4 border-green-600/30 backdrop-blur-sm"
      )}>
        
        {/* Header com informações das extremidades */}
        {showControls && (
          <div className="flex justify-between items-center p-4 border-b border-green-600/20">
            <div className="flex items-center gap-4">
              <div className="text-green-200 text-sm">
                <span className="font-semibold">Extremidades:</span>
                <span className="ml-2 px-2 py-1 bg-red-500/20 rounded text-red-200">
                  {boardEnds.leftEnd ?? '?'}
                </span>
                <span className="mx-2 text-green-400">←→</span>
                <span className="px-2 py-1 bg-blue-500/20 rounded text-blue-200">
                  {boardEnds.rightEnd ?? '?'}
                </span>
              </div>
              
              {!validation.isValid && (
                <div className="flex items-center gap-1 text-red-400 text-xs">
                  <Zap className="w-3 h-3" />
                  <span>{validation.errors.length} erro(s) de conexão</span>
                </div>
              )}
            </div>
            
            {/* Controles de navegação */}
            {layout.needsScroll && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToEnd('left')}
                  className="p-1 rounded bg-green-600/20 hover:bg-green-600/40 text-green-200"
                  title="Ir para início"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={scrollToCenter}
                  className="p-1 rounded bg-green-600/20 hover:bg-green-600/40 text-green-200"
                  title="Centralizar"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollToEnd('right')}
                  className="p-1 rounded bg-green-600/20 hover:bg-green-600/40 text-green-200"
                  title="Ir para fim"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Área principal do tabuleiro */}
        <div className="h-full p-6">
          <div 
            className={cn(
              "w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300",
              "flex items-center justify-center overflow-auto",
              placedPieces.length === 0 
                ? "border-yellow-400/50 bg-yellow-400/5 min-h-[300px]" 
                : "border-green-400/50 min-h-[250px]"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onScroll={handleScroll}
            ref={scrollContainerRef}
            data-testid="linear-game-board"
          >
            {placedPieces.length === 0 ? (
              <div className="text-center text-green-200">
                <div className="text-5xl mb-3">🎯</div>
                <p className="text-lg font-semibold">Arraste a primeira peça aqui</p>
                <p className="text-sm opacity-75 mt-2">O jogo começará com sua jogada</p>
              </div>
            ) : (
              <div 
                className="domino-board relative p-4"
                style={{ 
                  width: layout.totalWidth + 'px',
                  height: layout.totalHeight + 'px',
                  minWidth: '100%'
                }}
              >
                {/* Renderizar peças por linha com conexões corretas */}
                {layout.rows.map((row, rowIndex) => (
                  <div 
                    key={`row-${rowIndex}`}
                    className="domino-row absolute"
                    style={{
                      top: row.yOffset + 'px',
                      left: '0px'
                    }}
                  >
                    {row.pieces.map((connection, pieceIndex) => {
                      const piece = connection.piece;
                      const globalIndex = connection.index;
                      const isFirstInRow = pieceIndex === 0;
                      const isLastInRow = pieceIndex === row.pieces.length - 1;
                      const isLastPiece = globalIndex === placedPieces.length - 1;
                      
                      // Determinar os valores a exibir baseado na conexão
                      const displayTop = connection.isFlipped ? piece.bottom : piece.top;
                      const displayBottom = connection.isFlipped ? piece.top : piece.bottom;
                      
                      return (
                        <div 
                          key={`${piece.id}-${globalIndex}`}
                          className={cn(
                            "domino-piece-container relative",
                            connection.orientation === 'vertical' ? 'vertical-piece' : 'horizontal-piece',
                            isFirstInRow && 'first-piece',
                            isLastInRow && 'last-piece',
                            !isLastPiece && 'connected-right'
                          )}
                        >
                          <DominoPiece 
                            topValue={displayTop} 
                            bottomValue={displayBottom} 
                            isPlayable={false} 
                            className="shadow-lg hover:shadow-xl transition-shadow relative z-10" 
                            orientation={connection.orientation}
                          />
                          
                          {/* Conexão visual com a próxima peça */}
                          {!isLastPiece && (
                            <>
                              {/* Conexão horizontal dentro da linha */}
                              {!isLastInRow && (
                                <>
                                  <div className="domino-connection horizontal" />
                                  <div className="connection-value right">
                                    {connection.rightConnection}
                                  </div>
                                </>
                              )}
                              
                              {/* Conexão para quebra de linha */}
                              {isLastInRow && rowIndex < layout.rows.length - 1 && (
                                <>
                                  <div className="line-break-connector curved" />
                                  <div className="connection-value bottom">
                                    {connection.rightConnection}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Debug info simplificado */}
        {process.env.NODE_ENV === 'development' && showControls && (
          <div className="p-3 border-t border-green-600/20 bg-black/30 rounded-b-3xl">
            <div className="text-xs text-green-200 space-y-1">
              <div className="font-bold text-green-400">🎯 Tabuleiro de Dominó</div>
              <div className="flex flex-wrap gap-4">
                <span>Peças: {debugInfo.totalPieces}</span>
                <span>Linhas: {layout.rows.length}</span>
                <span>Conexões: {debugInfo.isSequenceValid ? '✅ Válidas' : '❌ Inválidas'}</span>
                <span>Extremidades: {boardEnds.leftEnd} ↔ {boardEnds.rightEnd}</span>
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
