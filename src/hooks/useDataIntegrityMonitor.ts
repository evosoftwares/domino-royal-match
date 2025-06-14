import { useCallback, useRef, useEffect } from 'react';
import { GameData, PlayerData } from '@/types/game';
import { UniversalPieceConverter } from '@/utils/universalPieceConverter';
import { toast } from 'sonner';

interface IntegrityIssue {
  type: 'format_mismatch' | 'invalid_piece' | 'corrupted_data' | 'missing_field';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  data: any;
  timestamp: number;
}

interface IntegrityReport {
  isHealthy: boolean;
  issues: IntegrityIssue[];
  score: number; // 0-100
  suggestions: string[];
}

export const useDataIntegrityMonitor = () => {
  const issueHistory = useRef<IntegrityIssue[]>([]);
  const lastCheck = useRef<number>(0);

  /**
   * Gera relatório de integridade
   */
  const generateReport = useCallback((issues: IntegrityIssue[]): IntegrityReport => {
    // Calcular score (0-100)
    let score = 100;
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });
    score = Math.max(0, score);

    // Gerar sugestões
    const suggestions: string[] = [];
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) {
      suggestions.push(`Resolver ${criticalIssues} problema(s) crítico(s) imediatamente`);
    }
    if (highIssues > 0) {
      suggestions.push(`Atenção para ${highIssues} problema(s) de alta prioridade`);
    }
    if (score < 80) {
      suggestions.push('Considerar atualização/sincronização dos dados');
    }
    if (issues.some(i => i.type === 'format_mismatch')) {
      suggestions.push('Verificar conversão de formatos de peças');
    }

    return {
      isHealthy: score >= 90 && criticalIssues === 0,
      issues,
      score,
      suggestions
    };
  }, []);

  /**
   * Monitora integridade dos dados do jogo
   */
  const checkGameDataIntegrity = useCallback((gameData: GameData): IntegrityReport => {
    const issues: IntegrityIssue[] = [];
    const timestamp = Date.now();

    // Verificar estrutura básica
    if (!gameData.id) {
      issues.push({
        type: 'missing_field',
        severity: 'critical',
        description: 'Game ID is missing',
        data: gameData,
        timestamp
      });
    }

    if (!gameData.status || !['waiting', 'active', 'finished'].includes(gameData.status)) {
      issues.push({
        type: 'invalid_piece',
        severity: 'high',
        description: `Invalid game status: ${gameData.status}`,
        data: gameData.status,
        timestamp
      });
    }

    // Verificar board_state
    if (gameData.board_state) {
      try {
        const boardState = gameData.board_state;
        
        if (boardState.pieces && Array.isArray(boardState.pieces)) {
          for (let i = 0; i < boardState.pieces.length; i++) {
            const piece = boardState.pieces[i];
            try {
              const universal = UniversalPieceConverter.toUniversal(piece, `board-check-${i}`);
              if (!universal.isValid) {
                issues.push({
                  type: 'invalid_piece',
                  severity: 'high',
                  description: `Invalid piece on board at position ${i}: [${universal.top}|${universal.bottom}]`,
                  data: piece,
                  timestamp
                });
              }
            } catch (error) {
              issues.push({
                type: 'format_mismatch',
                severity: 'medium',
                description: `Cannot parse piece at position ${i}: ${(error as Error).message}`,
                data: piece,
                timestamp
              });
            }
          }
        }

        // Verificar extremidades do tabuleiro
        if (typeof boardState.left_end === 'number' && (boardState.left_end < 0 || boardState.left_end > 6)) {
          issues.push({
            type: 'invalid_piece',
            severity: 'medium',
            description: `Invalid left_end: ${boardState.left_end}`,
            data: boardState.left_end,
            timestamp
          });
        }

        if (typeof boardState.right_end === 'number' && (boardState.right_end < 0 || boardState.right_end > 6)) {
          issues.push({
            type: 'invalid_piece',
            severity: 'medium',
            description: `Invalid right_end: ${boardState.right_end}`,
            data: boardState.right_end,
            timestamp
          });
        }
      } catch (error) {
        issues.push({
          type: 'corrupted_data',
          severity: 'critical',
          description: `Corrupted board_state: ${(error as Error).message}`,
          data: gameData.board_state,
          timestamp
        });
      }
    }

    return generateReport(issues);
  }, [generateReport]);

  /**
   * Monitora integridade dos dados dos jogadores
   */
  const checkPlayersDataIntegrity = useCallback((playersData: PlayerData[]): IntegrityReport => {
    const issues: IntegrityIssue[] = [];
    const timestamp = Date.now();

    if (!Array.isArray(playersData)) {
      issues.push({
        type: 'corrupted_data',
        severity: 'critical',
        description: 'Players data is not an array',
        data: playersData,
        timestamp
      });
      return generateReport(issues);
    }

    playersData.forEach((player, index) => {
      // Verificar estrutura básica do jogador
      if (!player.user_id) {
        issues.push({
          type: 'missing_field',
          severity: 'critical',
          description: `Player ${index} missing user_id`,
          data: player,
          timestamp
        });
      }

      if (typeof player.position !== 'number' || player.position < 1) {
        issues.push({
          type: 'invalid_piece',
          severity: 'high',
          description: `Player ${index} invalid position: ${player.position}`,
          data: player.position,
          timestamp
        });
      }

      // Verificar hand (mão do jogador)
      if (player.hand) {
        try {
          const hand = Array.isArray(player.hand) ? player.hand : [player.hand];
          
          for (let i = 0; i < hand.length; i++) {
            const piece = hand[i];
            try {
              const universal = UniversalPieceConverter.toUniversal(piece, `player-${index}-piece-${i}`);
              if (!universal.isValid) {
                issues.push({
                  type: 'invalid_piece',
                  severity: 'medium',
                  description: `Player ${index} invalid piece at position ${i}: [${universal.top}|${universal.bottom}]`,
                  data: piece,
                  timestamp
                });
              }
            } catch (error) {
              issues.push({
                type: 'format_mismatch',
                severity: 'low',
                description: `Player ${index} cannot parse piece at position ${i}: ${(error as Error).message}`,
                data: piece,
                timestamp
              });
            }
          }
        } catch (error) {
          issues.push({
            type: 'corrupted_data',
            severity: 'high',
            description: `Player ${index} corrupted hand data: ${(error as Error).message}`,
            data: player.hand,
            timestamp
          });
        }
      }
    });

    return generateReport(issues);
  }, [generateReport]);

  /**
   * Monitora integridade combinada
   */
  const checkFullGameIntegrity = useCallback((gameData: GameData, playersData: PlayerData[]): IntegrityReport => {
    const gameReport = checkGameDataIntegrity(gameData);
    const playersReport = checkPlayersDataIntegrity(playersData);

    // Combinar issues
    const combinedIssues = [...gameReport.issues, ...playersReport.issues];
    
    // Verificações de consistência entre jogo e jogadores
    const timestamp = Date.now();
    
    // Verificar se o jogador atual existe
    if (gameData.current_player_turn) {
      const currentPlayerExists = playersData.some(p => p.user_id === gameData.current_player_turn);
      if (!currentPlayerExists) {
        combinedIssues.push({
          type: 'missing_field',
          severity: 'critical',
          description: `Current player turn ${gameData.current_player_turn} not found in players list`,
          data: { gameData: gameData.current_player_turn, players: playersData.map(p => p.user_id) },
          timestamp
        });
      }
    }

    // Verificar posições duplicadas
    const positions = playersData.map(p => p.position).filter(p => typeof p === 'number');
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      combinedIssues.push({
        type: 'invalid_piece',
        severity: 'high',
        description: 'Duplicate player positions detected',
        data: positions,
        timestamp
      });
    }

    return generateReport(combinedIssues);
  }, [checkGameDataIntegrity, checkPlayersDataIntegrity, generateReport]);

  /**
   * Adiciona issue ao histórico e mostra toast se necessário
   */
  const handleIntegrityIssues = useCallback((report: IntegrityReport) => {
    // Adicionar ao histórico
    issueHistory.current.push(...report.issues);
    
    // Limitar histórico a últimas 100 issues
    if (issueHistory.current.length > 100) {
      issueHistory.current = issueHistory.current.slice(-100);
    }

    // Mostrar toast para issues críticas
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      toast.error(`${criticalIssues.length} problema(s) crítico(s) detectado(s) nos dados do jogo`);
    }

    lastCheck.current = Date.now();
  }, []);

  /**
   * Obter estatísticas do monitor
   */
  const getIntegrityStats = useCallback(() => {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recentIssues = issueHistory.current.filter(i => i.timestamp > last24h);
    
    return {
      totalIssues: issueHistory.current.length,
      recentIssues: recentIssues.length,
      lastCheck: lastCheck.current,
      issuesByType: {
        format_mismatch: recentIssues.filter(i => i.type === 'format_mismatch').length,
        invalid_piece: recentIssues.filter(i => i.type === 'invalid_piece').length,
        corrupted_data: recentIssues.filter(i => i.type === 'corrupted_data').length,
        missing_field: recentIssues.filter(i => i.type === 'missing_field').length,
      },
      issuesBySeverity: {
        critical: recentIssues.filter(i => i.severity === 'critical').length,
        high: recentIssues.filter(i => i.severity === 'high').length,
        medium: recentIssues.filter(i => i.severity === 'medium').length,
        low: recentIssues.filter(i => i.severity === 'low').length,
      }
    };
  }, []);

  // Auto-limpeza do histórico
  useEffect(() => {
    const interval = setInterval(() => {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      issueHistory.current = issueHistory.current.filter(i => i.timestamp > oneWeekAgo);
    }, 60 * 60 * 1000); // A cada hora

    return () => clearInterval(interval);
  }, []);

  return {
    checkGameDataIntegrity,
    checkPlayersDataIntegrity,
    checkFullGameIntegrity,
    handleIntegrityIssues,
    getIntegrityStats
  };
};
