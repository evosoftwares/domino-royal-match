
import { useRef, useCallback } from 'react';

interface StateVersion {
  version: number;
  timestamp: number;
  source: 'local' | 'realtime' | 'server';
}

interface OptimizedStateControl {
  validateStateUpdate: (newVersion: StateVersion, currentVersion: StateVersion) => boolean;
  createStateVersion: (source: 'local' | 'realtime' | 'server') => StateVersion;
  shouldApplyUpdate: (update: any, currentState: any) => boolean;
}

export const useOptimizedStateControl = (): OptimizedStateControl => {
  const versionRef = useRef<StateVersion>({
    version: 0,
    timestamp: Date.now(),
    source: 'local'
  });

  const validateStateUpdate = useCallback((newVersion: StateVersion, currentVersion: StateVersion): boolean => {
    // Prioridade: server > realtime > local
    const sourcePriority = { 'server': 3, 'realtime': 2, 'local': 1 };
    
    // Se a versão é mais nova ou de fonte prioritária
    if (newVersion.version > currentVersion.version) return true;
    if (newVersion.version === currentVersion.version && 
        sourcePriority[newVersion.source] > sourcePriority[currentVersion.source]) return true;
    
    // Evitar updates muito antigos (mais de 30 segundos)
    const timeDiff = Date.now() - newVersion.timestamp;
    if (timeDiff > 30000) return false;
    
    return false;
  }, []);

  const createStateVersion = useCallback((source: 'local' | 'realtime' | 'server'): StateVersion => {
    const newVersion = {
      version: versionRef.current.version + 1,
      timestamp: Date.now(),
      source
    };
    versionRef.current = newVersion;
    return newVersion;
  }, []);

  const shouldApplyUpdate = useCallback((update: any, currentState: any): boolean => {
    // Verificações básicas de integridade
    if (!update || typeof update !== 'object') return false;
    
    // Evitar updates idênticos
    if (JSON.stringify(update) === JSON.stringify(currentState)) return false;
    
    return true;
  }, []);

  return {
    validateStateUpdate,
    createStateVersion,
    shouldApplyUpdate
  };
};
