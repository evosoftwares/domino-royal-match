
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
}

const DominoPiece: React.FC<DominoPieceProps> = ({
  topValue,
  bottomValue,
  isDragging = false,
  isPlayable = true,
  onClick,
  onDragStart,
  onDragEnd,
  className
}) => {
  const renderDots = (value: number, position: 'top' | 'bottom') => {
    // Safety check: ensure value is within valid range (0-6)
    const safeValue = Math.max(0, Math.min(6, Math.floor(value || 0)));
    
    // Grid positions based on your specification (1-9 grid)
    const dotPositions = {
      0: [], // Nenhuma bolinha
      1: [5], // Uma bolinha no centro
      2: [1, 9], // Duas bolinhas em uma diagonal
      3: [1, 5, 9], // Três bolinhas na mesma diagonal
      4: [1, 3, 7, 9], // Uma bolinha em cada canto
      5: [1, 3, 5, 7, 9], // Uma bolinha em cada canto e uma no centro
      6: [1, 4, 7, 3, 6, 9] // Duas colunas verticais com três bolinhas cada
    };

    const positions = dotPositions[safeValue as keyof typeof dotPositions] || [];

    return (
      <div className={cn(
        "relative w-full h-12 bg-white rounded-lg border border-gray-300",
        position === 'bottom' && "border-t-2 border-t-gray-400"
      )}>
        <div className="absolute inset-1 grid grid-cols-3 grid-rows-3 gap-0">
          {/* Create all 9 grid positions */}
          {Array.from({ length: 9 }, (_, index) => {
            const gridPosition = index + 1; // Grid positions 1-9
            const shouldShowDot = positions.includes(gridPosition);
            
            return (
              <div
                key={gridPosition}
                className="flex items-center justify-center"
              >
                {shouldShowDot && (
                  <div className="w-2 h-2 bg-black rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "w-16 h-32 bg-gradient-to-b from-gray-100 to-gray-200 rounded-xl shadow-lg cursor-pointer transition-all duration-200 border-2 border-gray-300",
        isPlayable && "hover:shadow-xl hover:scale-105 hover:border-yellow-400",
        isDragging && "opacity-50 rotate-12 scale-110",
        !isPlayable && "opacity-50 cursor-not-allowed",
        className
      )}
      draggable={isPlayable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="p-1 h-full flex flex-col gap-1">
        {renderDots(topValue, 'top')}
        {renderDots(bottomValue, 'bottom')}
      </div>
    </div>
  );
};

export default DominoPiece;
