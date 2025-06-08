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
    
    // Posições dos pontos em um grid 3x3 para um layout clássico.
    const dotPatterns = {
      0: [],
      1: ["center"],
      2: ["top-left", "bottom-right"],
      3: ["top-left", "center", "bottom-right"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"],
    };

    const positions = dotPatterns[safeValue as keyof typeof dotPatterns] || [];
    
    return (
      <div className="relative w-full h-full">
        {positions.map(pos => (
          <div key={pos} className={cn("absolute w-2.5 h-2.5 bg-white rounded-full", {
            "top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2": pos === 'top-left',
            "top-1/4 right-1/4 translate-x-1/2 -translate-y-1/2": pos === 'top-right',
            "top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2": pos === 'middle-left',
            "top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2": pos === 'middle-right',
            "bottom-1/4 left-1/4 -translate-x-1/2 translate-y-1/2": pos === 'bottom-left',
            "bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2": pos === 'bottom-right',
            "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2": pos === 'center',
          })} />
        ))}
      </div>
    );
  };

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        "flex rounded-md md:rounded-lg shadow-lg border-gray-700 border",
        "bg-gradient-to-br from-gray-900 to-black",
        isVertical 
          ? "w-12 h-24 md:w-16 md:h-32 flex-col" 
          : "w-24 h-12 md:w-32 md:h-16 flex-row",
        "transition-all duration-200",

        isPlayable && "cursor-pointer hover:shadow-cyan-400/30 hover:border-cyan-400",
        isDragging && "opacity-50 scale-105 rotate-3",
        !isPlayable && "opacity-60 cursor-not-allowed grayscale",
        
        className
      )}
      draggable={isPlayable}
      onClick={isPlayable ? onClick : undefined}
      onDragStart={isPlayable ? onDragStart : undefined}
      onDragEnd={isPlayable ? onDragEnd : undefined}
    >
      <div className="flex-1 p-1 md:p-2">{renderDots(topValue)}</div>
      <div className={cn(
        "bg-gray-600",
        isVertical ? "h-px w-10/12 self-center" : "w-px h-10/12 self-center"
      )} />
      <div className="flex-1 p-1 md:p-2">{renderDots(bottomValue)}</div>
    </div>
  );
};

export default DominoPiece;