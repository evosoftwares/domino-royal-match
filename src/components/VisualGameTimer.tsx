
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualGameTimerProps {
  timeLeft: number;
  totalTime?: number;
  isMyTurn: boolean;
  isWarning: boolean;
  onAutoPlay?: () => void;
  className?: string;
}

const VisualGameTimer: React.FC<VisualGameTimerProps> = ({
  timeLeft,
  totalTime = 10,
  isMyTurn,
  isWarning,
  onAutoPlay,
  className
}) => {
  const progressPercent = (timeLeft / totalTime) * 100;
  
  if (!isMyTurn) {
    return null;
  }

  return (
    <div className={cn(
      "bg-gradient-to-r from-purple-900/50 to-black/50 rounded-lg p-3 border transition-all duration-300",
      isWarning 
        ? "border-red-400 shadow-lg shadow-red-400/20 animate-pulse" 
        : "border-yellow-400 shadow-lg shadow-yellow-400/20",
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className={cn(
            "w-4 h-4",
            isWarning ? "text-red-400" : "text-yellow-400"
          )} />
          <span className={cn(
            "text-sm font-semibold",
            isWarning ? "text-red-400" : "text-yellow-400"
          )}>
            Sua Vez
          </span>
        </div>
        
        <div className={cn(
          "font-mono text-lg font-bold px-2 py-1 rounded",
          isWarning 
            ? "bg-red-500 text-white" 
            : "bg-yellow-400 text-black"
        )}>
          {timeLeft}s
        </div>
      </div>

      <div className="space-y-2">
        <Progress 
          value={progressPercent} 
          className={cn(
            "h-2 transition-all duration-1000",
            isWarning && "animate-pulse"
          )}
        />
        
        <div className="flex items-center justify-between text-xs">
          <span className={cn(
            isWarning ? "text-red-300" : "text-yellow-300"
          )}>
            {isWarning ? "⚠️ Jogada automática em breve!" : "Tempo para jogar"}
          </span>
          
          {onAutoPlay && (
            <button
              onClick={onAutoPlay}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                "hover:scale-105 active:scale-95",
                isWarning 
                  ? "bg-red-400/20 text-red-300 hover:bg-red-400/30" 
                  : "bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30"
              )}
            >
              <Zap className="w-3 h-3" />
              Auto
            </button>
          )}
        </div>
      </div>
      
      {timeLeft <= 0 && (
        <div className="mt-2 text-center">
          <span className="text-red-400 text-xs font-semibold animate-pulse">
            🤖 Executando jogada automática...
          </span>
        </div>
      )}
    </div>
  );
};

export default VisualGameTimer;
