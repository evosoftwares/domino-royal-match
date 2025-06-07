
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
    const dotPositions = {
      0: [],
      1: ['center'],
      2: ['top-left', 'bottom-right'],
      3: ['top-left', 'center', 'bottom-right'],
      4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
      6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
    };

    return (
      <div className={cn(
        "relative w-full h-12 bg-white rounded-lg border border-gray-300",
        position === 'bottom' && "border-t-2 border-t-gray-400"
      )}>
        <div className="absolute inset-1 grid grid-cols-3 grid-rows-3 gap-1">
          {dotPositions[value as keyof typeof dotPositions].map((dotPosition, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 bg-black rounded-full",
                dotPosition === 'top-left' && "justify-self-start self-start",
                dotPosition === 'top-right' && "justify-self-end self-start",
                dotPosition === 'center' && "justify-self-center self-center",
                dotPosition === 'middle-left' && "justify-self-start self-center",
                dotPosition === 'middle-right' && "justify-self-end self-center",
                dotPosition === 'bottom-left' && "justify-self-start self-end",
                dotPosition === 'bottom-right' && "justify-self-end self-end"
              )}
            />
          ))}
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
