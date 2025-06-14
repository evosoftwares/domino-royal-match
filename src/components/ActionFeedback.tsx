
import React from 'react';
import { cn } from '@/lib/utils';
import LoadingState from './LoadingState';

interface ActionFeedbackProps {
  isProcessing: boolean;
  action: 'playing' | 'passing' | 'auto_playing' | null;
  className?: string;
}

const ActionFeedback: React.FC<ActionFeedbackProps> = ({
  isProcessing,
  action,
  className
}) => {
  if (!isProcessing || !action) return null;

  const getActionMessage = () => {
    switch (action) {
      case 'playing':
        return 'Jogando peça...';
      case 'passing':
        return 'Passando a vez...';
      case 'auto_playing':
        return 'Jogada automática...';
      default:
        return 'Processando...';
    }
  };

  return (
    <div className={cn(
      "fixed top-4 right-4 bg-purple-900/90 backdrop-blur-sm rounded-lg p-3 border border-purple-600/50 shadow-lg z-40",
      className
    )}>
      <LoadingState 
        message={getActionMessage()} 
        size="sm" 
      />
    </div>
  );
};

export default ActionFeedback;
