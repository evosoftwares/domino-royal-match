
import React, { useRef, useEffect } from 'react';
import { DominoPieceType } from '@/types/game';
import DominoPiece from '../DominoPiece';
import { cn } from '@/lib/utils';
import { useBoardLayout } from '@/hooks/useBoardLayout';
import { ChevronLeft, ChevronRight, RotateCcw, Zap } from 'lucide-react';

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

  // Sincronizar scroll do container com o estado
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
        "w-full max-w-5xl min-h-[300px]",
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
                  <span>{validation.errors.length} erro(s)</span>
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
                ? "border-yellow-400/50 bg-yellow-400/5 min-h-[200px]" 
                : "border-green-400/50 min-h-[150px]"
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
                className="relative p-4"
                style={{ 
                  width: layout.totalWidth + 'px',
                  height: layout.totalHeight + 'px',
                  minWidth: '100%'
                }}
              >
                {/* Renderizar peças por linhas */}
                {layout.rows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="absolute">
                    {row.pieces.map((connection, pieceIndex) => {
                      const piece = connection.piece;
                      const globalIndex = connection.index;
                      
                      return (
                        <div 
                          key={`${piece.id}-${globalIndex}`}
                          className="absolute transition-all duration-300"
                          style={{
                            left: connection.position.x + 'px',
                            top: connection.position.y + 'px'
                          }}
                        >
                          <div className="relative">
                            <DominoPiece 
                              topValue={piece.top} 
                              bottomValue={piece.bottom} 
                              isPlayable={false} 
                              className="shadow-xl hover:shadow-2xl transition-shadow" 
                              orientation={connection.orientation}
                            />
                            
                            {/* Indicador da primeira peça (extremidade esquerda) */}
                            {globalIndex === 0 && (
                              <div 
                                className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-400 rounded-full animate-pulse" 
                                title={`Extremidade esquerda: ${connection.leftConnection}`}
                              />
                            )}
                            
                            {/* Indicador da última peça (extremidade direita) */}
                            {globalIndex === placedPieces.length - 1 && (
                              <div 
                                className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full animate-pulse" 
                                title={`Extremidade direita: ${connection.rightConnection}`}
                              />
                            )}
                            
                            {/* Números das peças */}
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 text-white text-xs rounded-full flex items-center justify-center opacity-70">
                              {globalIndex + 1}
                            </div>
                            
                            {/* Indicadores de conexão em desenvolvimento */}
                            {process.env.NODE_ENV === 'development' && (
                              <>
                                <div className="absolute -bottom-2 -left-2 text-xs bg-purple-600 text-white px-1 rounded opacity-75">
                                  {connection.orientation === 'vertical' ? 'V' : 'H'}
                                </div>
                                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs bg-black text-white px-1 rounded opacity-75 whitespace-nowrap">
                                  {connection.leftConnection}|{connection.rightConnection}
                                </div>
                              </>
                            )}
                            
                            {/* Indicador de erro de conexão */}
                            {!validation.isValid && validation.errors.some(error => error.includes(`Peça ${globalIndex}`)) && (
                              <div className="absolute inset-0 border-2 border-red-500 rounded-lg animate-pulse" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Debug info para desenvolvimento */}
        {process.env.NODE_ENV === 'development' && showControls && (
          <div className="p-3 border-t border-green-600/20 bg-black/30 rounded-b-3xl">
            <div className="text-xs text-green-200 space-y-1">
              <div className="font-bold text-green-400">🎯 Linear Layout Debug</div>
              <div className="flex flex-wrap gap-4">
                <span>Peças: {debugInfo.totalPieces}</span>
                <span>Linhas: {debugInfo.layoutRows}</span>
                <span>Largura: {debugInfo.totalWidth}px</span>
                <span>Scroll: {layout.needsScroll ? '✅' : '❌'}</span>
                <span>Válido: {debugInfo.isSequenceValid ? '✅' : '❌'}</span>
                <span>ScrollX: {Math.round(scrollX)}px</span>
              </div>
              {debugInfo.validationErrors.length > 0 && (
                <div className="text-red-400 text-xs">
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
