
import { useCallback, useRef } from 'react';
import { GameData, PlayerData } from '@/types/game';

export interface ConflictType {
  id: string;
  type: 'board_state' | 'player_turn' | 'player_hand' | 'game_status';
  severity: 'low' | 'medium' | 'high' | 'critical';
  localValue: any;
  serverValue: any;
  timestamp: number;
  autoResolvable: boolean;
  description: string;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'use_local' | 'use_server' | 'merge' | 'manual';
  mergedValue?: any;
}

interface UseConflictDetectionProps {
  onConflictDetected: (conflict: ConflictType) => void;
  onConflictResolved: (resolution: ConflictResolution) => void;
}

export const useConflictDetection = ({ 
  onConflictDetected, 
  onConflictResolved 
}: UseConflictDetectionProps) => {
  const detectedConflicts = useRef<Map<string, ConflictType>>(new Map());

  // Detectar conflitos entre estado local e servidor
  const detectConflicts = useCallback((
    localGameState: GameData,
    serverGameState: GameData,
    localPlayersState: PlayerData[],
    serverPlayersState: PlayerData[]
  ): ConflictType[] => {
    const conflicts: ConflictType[] = [];

    // 1. Conflito de turno do jogador
    if (localGameState.current_player_turn !== serverGameState.current_player_turn) {
      const conflict: ConflictType = {
        id: `player_turn_${Date.now()}`,
        type: 'player_turn',
        severity: 'high',
        localValue: localGameState.current_player_turn,
        serverValue: serverGameState.current_player_turn,
        timestamp: Date.now(),
        autoResolvable: true, // Servidor sempre ganha
        description: 'Conflito no turno do jogador atual'
      };
      conflicts.push(conflict);
    }

    // 2. Conflito no status do jogo
    if (localGameState.status !== serverGameState.status) {
      const conflict: ConflictType = {
        id: `game_status_${Date.now()}`,
        type: 'game_status',
        severity: 'critical',
        localValue: localGameState.status,
        serverValue: serverGameState.status,
        timestamp: Date.now(),
        autoResolvable: true, // Servidor sempre ganha
        description: 'Conflito no status do jogo'
      };
      conflicts.push(conflict);
    }

    // 3. Conflito no estado do tabuleiro
    const localPiecesCount = localGameState.board_state?.pieces?.length || 0;
    const serverPiecesCount = serverGameState.board_state?.pieces?.length || 0;
    
    if (Math.abs(localPiecesCount - serverPiecesCount) > 1) {
      const conflict: ConflictType = {
        id: `board_state_${Date.now()}`,
        type: 'board_state',
        severity: 'critical',
        localValue: localGameState.board_state,
        serverValue: serverGameState.board_state,
        timestamp: Date.now(),
        autoResolvable: false, // Requer intervenção manual
        description: `Conflito crítico no tabuleiro: ${localPiecesCount} vs ${serverPiecesCount} peças`
      };
      conflicts.push(conflict);
    }

    // 4. Conflitos nas mãos dos jogadores
    localPlayersState.forEach(localPlayer => {
      const serverPlayer = serverPlayersState.find(p => p.user_id === localPlayer.user_id);
      if (serverPlayer) {
        const localHandSize = localPlayer.hand?.length || 0;
        const serverHandSize = serverPlayer.hand?.length || 0;
        
        if (Math.abs(localHandSize - serverHandSize) > 1) {
          const conflict: ConflictType = {
            id: `player_hand_${localPlayer.user_id}_${Date.now()}`,
            type: 'player_hand',
            severity: 'high',
            localValue: localPlayer.hand,
            serverValue: serverPlayer.hand,
            timestamp: Date.now(),
            autoResolvable: false, // Mãos são críticas
            description: `Conflito na mão do jogador: ${localHandSize} vs ${serverHandSize} peças`
          };
          conflicts.push(conflict);
        }
      }
    });

    return conflicts;
  }, []);

  // Resolver conflito automaticamente (se possível)
  const resolveConflictAutomatically = useCallback((conflict: ConflictType): ConflictResolution | null => {
    if (!conflict.autoResolvable) return null;

    let resolution: ConflictResolution;

    switch (conflict.type) {
      case 'player_turn':
      case 'game_status':
        // Servidor sempre ganha para status críticos
        resolution = {
          conflictId: conflict.id,
          resolution: 'use_server'
        };
        break;

      default:
        return null;
    }

    console.log('🔧 Resolvendo conflito automaticamente:', resolution);
    onConflictResolved(resolution);
    detectedConflicts.current.delete(conflict.id);
    
    return resolution;
  }, [onConflictResolved]);

  // Resolver conflito manualmente
  const resolveConflictManually = useCallback((
    conflictId: string, 
    resolution: 'use_local' | 'use_server' | 'merge',
    mergedValue?: any
  ): ConflictResolution => {
    const conflictResolution: ConflictResolution = {
      conflictId,
      resolution,
      mergedValue
    };

    console.log('👤 Resolvendo conflito manualmente:', conflictResolution);
    onConflictResolved(conflictResolution);
    detectedConflicts.current.delete(conflictId);

    return conflictResolution;
  }, [onConflictResolved]);

  // Processar conflitos detectados
  const processConflicts = useCallback((
    localGameState: GameData,
    serverGameState: GameData,
    localPlayersState: PlayerData[],
    serverPlayersState: PlayerData[]
  ) => {
    const conflicts = detectConflicts(
      localGameState, 
      serverGameState, 
      localPlayersState, 
      serverPlayersState
    );

    conflicts.forEach(conflict => {
      // Armazenar conflito
      detectedConflicts.current.set(conflict.id, conflict);
      
      // Notificar sobre o conflito
      onConflictDetected(conflict);
      
      // Tentar resolução automática
      resolveConflictAutomatically(conflict);
    });

    return conflicts;
  }, [detectConflicts, onConflictDetected, resolveConflictAutomatically]);

  // Merge inteligente para mudanças não conflitantes
  const intelligentMerge = useCallback((
    localGameState: GameData,
    serverGameState: GameData,
    localPlayersState: PlayerData[],
    serverPlayersState: PlayerData[]
  ): { gameState: GameData; playersState: PlayerData[] } => {
    console.log('🔀 Executando merge inteligente...');

    // Usar estado do servidor como base
    const mergedGameState: GameData = {
      ...serverGameState,
      // Manter algumas preferências locais se não conflitarem
      board_state: serverGameState.board_state || localGameState.board_state
    };

    // Merge dos jogadores: servidor ganha para dados críticos
    const mergedPlayersState = serverPlayersState.map(serverPlayer => {
      const localPlayer = localPlayersState.find(p => p.user_id === serverPlayer.user_id);
      
      return {
        ...serverPlayer,
        // Manter algumas preferências locais se não críticas
        // (por enquanto, servidor sempre ganha)
      };
    });

    console.log('✅ Merge inteligente concluído');
    return {
      gameState: mergedGameState,
      playersState: mergedPlayersState
    };
  }, []);

  // Obter conflitos pendentes
  const getPendingConflicts = useCallback(() => {
    return Array.from(detectedConflicts.current.values());
  }, []);

  // Limpar conflitos resolvidos
  const clearResolvedConflicts = useCallback(() => {
    detectedConflicts.current.clear();
  }, []);

  return {
    detectConflicts,
    processConflicts,
    resolveConflictAutomatically,
    resolveConflictManually,
    intelligentMerge,
    getPendingConflicts,
    clearResolvedConflicts
  };
};
