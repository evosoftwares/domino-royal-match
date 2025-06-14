
import { useCallback, useState, useRef } from 'react';
import { GameData, PlayerData } from '@/types/game';
import { useConflictDetection, ConflictType, ConflictResolution } from './useConflictDetection';
import { toast } from 'sonner';

interface UseSmartReconciliationProps {
  onStateReconciled: (gameState: GameData, playersState: PlayerData[]) => void;
  onCriticalConflict: (conflicts: ConflictType[]) => void;
}

type ReconciliationStatus = 'idle' | 'detecting' | 'resolving' | 'waiting_user';

export const useSmartReconciliation = ({
  onStateReconciled,
  onCriticalConflict
}: UseSmartReconciliationProps) => {
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationStatus>('idle');
  const [criticalConflicts, setCriticalConflicts] = useState<ConflictType[]>([]);
  const reconciliationStats = useRef({
    totalConflicts: 0,
    autoResolved: 0,
    manualResolved: 0,
    lastReconciliation: Date.now()
  });

  // Handler para conflitos detectados
  const handleConflictDetected = useCallback((conflict: ConflictType) => {
    reconciliationStats.current.totalConflicts++;
    
    console.log(`🚨 Conflito detectado [${conflict.severity}]:`, conflict.description);
    
    if (conflict.severity === 'critical') {
      setCriticalConflicts(prev => [...prev, conflict]);
      setReconciliationStatus('waiting_user');
      onCriticalConflict([conflict]);
      toast.error(`Conflito crítico: ${conflict.description}`);
    } else {
      toast.warning(`Conflito detectado: ${conflict.description}`);
    }
  }, [onCriticalConflict]);

  // Handler para conflitos resolvidos
  const handleConflictResolved = useCallback((resolution: ConflictResolution) => {
    if (resolution.resolution === 'manual') {
      reconciliationStats.current.manualResolved++;
      toast.success('Conflito resolvido manualmente');
    } else {
      reconciliationStats.current.autoResolved++;
      toast.info('Conflito resolvido automaticamente');
    }

    // Remover conflito da lista crítica
    setCriticalConflicts(prev => 
      prev.filter(c => c.id !== resolution.conflictId)
    );

    console.log('✅ Conflito resolvido:', resolution);
  }, []);

  // Hook de detecção de conflitos
  const {
    processConflicts,
    intelligentMerge,
    resolveConflictManually,
    getPendingConflicts,
    clearResolvedConflicts
  } = useConflictDetection({
    onConflictDetected: handleConflictDetected,
    onConflictResolved: handleConflictResolved
  });

  // Reconciliar estados local e servidor
  const reconcileStates = useCallback(async (
    localGameState: GameData,
    serverGameState: GameData,
    localPlayersState: PlayerData[],
    serverPlayersState: PlayerData[]
  ): Promise<boolean> => {
    setReconciliationStatus('detecting');
    reconciliationStats.current.lastReconciliation = Date.now();

    try {
      console.log('🔍 Iniciando reconciliação inteligente...');

      // 1. Detectar conflitos
      const conflicts = processConflicts(
        localGameState,
        serverGameState, 
        localPlayersState,
        serverPlayersState
      );

      // 2. Se há conflitos críticos, parar e aguardar resolução manual
      const criticalConflictsFound = conflicts.filter(c => c.severity === 'critical');
      if (criticalConflictsFound.length > 0) {
        console.warn('🛑 Conflitos críticos encontrados, aguardando resolução manual');
        setReconciliationStatus('waiting_user');
        return false;
      }

      // 3. Se não há conflitos críticos, fazer merge inteligente
      setReconciliationStatus('resolving');
      const { gameState: mergedGameState, playersState: mergedPlayersState } = intelligentMerge(
        localGameState,
        serverGameState,
        localPlayersState,
        serverPlayersState
      );

      // 4. Aplicar estado reconciliado
      onStateReconciled(mergedGameState, mergedPlayersState);
      
      setReconciliationStatus('idle');
      console.log('✅ Reconciliação concluída com sucesso');
      
      if (conflicts.length > 0) {
        toast.success(`Reconciliação concluída: ${conflicts.length} conflitos resolvidos`);
      }

      return true;
    } catch (error) {
      console.error('❌ Erro durante reconciliação:', error);
      setReconciliationStatus('idle');
      toast.error('Erro durante reconciliação de estados');
      return false;
    }
  }, [processConflicts, intelligentMerge, onStateReconciled]);

  // Resolver conflito crítico manualmente
  const resolveCriticalConflict = useCallback((
    conflictId: string,
    resolution: 'use_local' | 'use_server' | 'merge',
    mergedValue?: any
  ) => {
    const resolved = resolveConflictManually(conflictId, resolution, mergedValue);
    
    // Se não há mais conflitos críticos, tentar continuar reconciliação
    const pendingCritical = getPendingConflicts().filter(c => c.severity === 'critical');
    if (pendingCritical.length === 0) {
      setReconciliationStatus('idle');
      toast.success('Todos os conflitos críticos foram resolvidos');
    }

    return resolved;
  }, [resolveConflictManually, getPendingConflicts]);

  // Forçar reconciliação (ignorar conflitos não críticos)
  const forceReconciliation = useCallback((
    localGameState: GameData,
    serverGameState: GameData,
    localPlayersState: PlayerData[],
    serverPlayersState: PlayerData[]
  ) => {
    console.log('🔧 Forçando reconciliação...');
    
    // Limpar conflitos anteriores
    clearResolvedConflicts();
    setCriticalConflicts([]);
    
    // Fazer merge priorizando servidor
    const { gameState: mergedGameState, playersState: mergedPlayersState } = intelligentMerge(
      localGameState,
      serverGameState,
      localPlayersState,
      serverPlayersState
    );

    onStateReconciled(mergedGameState, mergedPlayersState);
    setReconciliationStatus('idle');
    
    toast.success('Reconciliação forçada concluída');
  }, [intelligentMerge, onStateReconciled, clearResolvedConflicts]);

  // Obter estatísticas de reconciliação
  const getReconciliationStats = useCallback(() => {
    const pending = getPendingConflicts();
    const pendingCritical = pending.filter(c => c.severity === 'critical');
    
    return {
      ...reconciliationStats.current,
      pendingConflicts: pending.length,
      pendingCriticalConflicts: pendingCritical.length,
      status: reconciliationStatus,
      successRate: reconciliationStats.current.totalConflicts > 0 
        ? ((reconciliationStats.current.autoResolved + reconciliationStats.current.manualResolved) / reconciliationStats.current.totalConflicts) * 100 
        : 100
    };
  }, [getPendingConflicts, reconciliationStatus]);

  return {
    // Funções principais
    reconcileStates,
    resolveCriticalConflict,
    forceReconciliation,
    
    // Estado
    reconciliationStatus,
    criticalConflicts,
    
    // Estatísticas
    getReconciliationStats,
    
    // Utilities
    clearAllConflicts: clearResolvedConflicts
  };
};
