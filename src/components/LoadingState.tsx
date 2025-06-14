
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSpinner?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Processando...',
  size = 'md',
  className,
  showSpinner = true
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className={cn(
      "flex items-center justify-center gap-2 text-purple-200",
      sizeClasses[size],
      className
    )}>
      {showSpinner && (
        <Loader2 className={cn(
          "animate-spin text-yellow-400",
          spinnerSizes[size]
        )} />
      )}
      <span>{message}</span>
    </div>
  );
};

export default LoadingState;
