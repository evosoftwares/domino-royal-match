
import { useState, useEffect } from 'react';

interface UseGameDebugProps {
  onRunTests: () => void;
  onResetMetrics: () => void;
  onForceSync: () => void;
}

export const useGameDebug = ({
  onRunTests,
  onResetMetrics,
  onForceSync,
}: UseGameDebugProps) => {
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'h':
            event.preventDefault();
            setShowHealthDashboard(prev => !prev);
            break;
          case 't':
            event.preventDefault();
            onRunTests();
            break;
          case 'r':
            event.preventDefault();
            onResetMetrics();
            break;
          case 's':
            event.preventDefault();
            onForceSync();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onRunTests, onResetMetrics, onForceSync]);

  return {
    showHealthDashboard,
    setShowHealthDashboard,
  };
};

