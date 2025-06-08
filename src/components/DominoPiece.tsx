import React from 'react';
import { cn } from '@/lib/utils';

interface DominoPieceProps {
  topValue: number;
  bottomValue: number;
  isDragging?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

const DominoPiece: React.FC<DominoPieceProps> = ({
  topValue,
  bottomValue,
  isDragging = false,
  isPlayable = true,
  onClick,
  onDragStart,
  onDragEnd,
  className,
  orientation = 'vertical'
}) => {
  const renderDots = (value: number) => {
    const safeValue = Math.max(0, Math.min(6, Math.floor(value || 0)));
    
    // Posições dos pontos em um grid 3x3 mais intuitivo
    const dotPatterns = {
      0: [],
      1: [4], // Centro
      2: [0, 8], // Diagonal principal
      3: [0, 4, 8], // Diagonal principal + centro
      4: [0, 2, 6, 8], // Quatro cantos
      5: [0, 2, 4, 6, 8], // Quatro cantos + centro
      6: [0, 1, 2, 6, 7, 8] // Duas colunas laterais
    };

    const positions = dotPatterns[safeValue as keyof typeof dotPatterns] || [];
    
    return (
      <div className={cn(
        "relative flex-1 bg-gradient-to-br from-white to-gray-50 rounded-md",
        "border border-gray-200 shadow-inner"
      )}>
        <div className="absolute inset-2 grid grid-cols-3 grid-rows-3 gap-0">
          {Array.from({ length: 9 }, (_, index) => {
            const shouldShowDot = positions.includes(index);
            
            return (
              <div
                key={index}
                className="flex items-center justify-center"
              >
                {shouldShowDot && (
                  <div className={cn(
                    "rounded-full bg-gradient-to-br from-gray-800 to-black shadow-sm",
                    "w-2 h-2 sm:w-2.5 sm:h-2.5" // Responsive dot size
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        // Base styling - proporções mais realistas de dominó
        isVertical ? "w-14 h-28" : "w-28 h-14",
        "bg-gradient-to-br from-gray-50 via-white to-gray-100",
        "rounded-xl shadow-lg border-2 border-gray-200",
        "transition-all duration-300 ease-out",
        
        // Interactive states
        isPlayable && [
          "cursor-pointer",
          "hover:shadow-xl hover:scale-105 hover:-translate-y-1",
          "hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:via-white hover:to-blue-50",
          "active:scale-95 active:shadow-md"
        ],
        
        // Dragging state
        isDragging && [
          "opacity-70 rotate-6 scale-110 z-50",
          "shadow-2xl border-blue-400"
        ],
        
        // Disabled state
        !isPlayable && [
          "opacity-40 cursor-not-allowed grayscale",
          "hover:scale-100 hover:shadow-lg hover:translate-y-0"
        ],
        
        className
      )}
      draggable={isPlayable}
      onClick={isPlayable ? onClick : undefined}
      onDragStart={isPlayable ? onDragStart : undefined}
      onDragEnd={isPlayable ? onDragEnd : undefined}
    >
      {/* Conteúdo interno com padding adequado */}
      <div className={cn(
        "p-2 h-full flex gap-1",
        isVertical ? "flex-col" : "flex-row"
      )}>
        {renderDots(topValue)}
        
        {/* Linha divisória central */}
        <div className={cn(
          "bg-gradient-to-r from-transparent via-gray-300 to-transparent rounded-full",
          isVertical ? "h-0.5 w-full" : "w-0.5 h-full"
        )} />
        
        {renderDots(bottomValue)}
      </div>
      
      {/* Efeito de brilho sutil */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent rounded-xl pointer-events-none" />
    </div>
  );
};

export default DominoPiece;