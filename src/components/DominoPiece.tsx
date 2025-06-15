
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
  // Renderizar pontos usando CSS classes
  const renderDots = (value: number) => {
    const safeValue = Math.max(0, Math.min(6, Math.floor(value || 0)));
    const dots = [];
    
    // Criar o número correto de spans para os pontos
    for (let i = 0; i < safeValue; i++) {
      dots.push(<span key={i} className="dot"></span>);
    }
    
    return dots;
  };

  // Determinar se é uma peça dupla
  const isDupla = topValue === bottomValue && topValue > 0;
  
  // Determinar a orientação final
  const finalOrientation = isDupla ? 'dupla' : orientation;

  return (
    <div
      className={cn(
        "domino",
        finalOrientation === 'vertical' && "vertical",
        finalOrientation === 'dupla' && "dupla",
        isDragging && "opacity-80 scale-105 rotate-3 z-20",
        !isPlayable && "opacity-60 cursor-not-allowed grayscale",
        isPlayable && "cursor-pointer hover:shadow-cyan-400/40",
        className
      )}
      draggable={isPlayable}
      onClick={isPlayable ? onClick : undefined}
      onDragStart={isPlayable ? onDragStart : undefined}
      onDragEnd={isPlayable ? onDragEnd : undefined}
    >
      <div className={cn("face", `face-${topValue}`)}>
        {renderDots(topValue)}
      </div>
      <div className={cn("face", `face-${bottomValue}`)}>
        {renderDots(bottomValue)}
      </div>
    </div>
  );
};

export default DominoPiece;
