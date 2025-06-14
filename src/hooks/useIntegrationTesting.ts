
import { useCallback, useState } from 'react';
import { GameData, PlayerData, DominoPieceType } from '@/types/game';
import { toast } from 'sonner';
import { IntegrationTestSuite } from './testing/types';
import { testTwoPhaseCommit } from './testing/testTwoPhaseCommit';
import { testCircuitBreaker } from './testing/testCircuitBreaker';
import { testReconciliation } from './testing/testReconciliation';
import { testPerformance } from './testing/testPerformance';

interface RunTestsParams {
  gameState: GameData;
  playersState: PlayerData[];
  playPiece: (piece: DominoPieceType) => Promise<boolean>;
  shouldAllowRequest: () => boolean;
  recordFailure: (time: number, error: any) => void;
  reconcileStates: (local: GameData, server: GameData, localPlayers: PlayerData[], serverPlayers: PlayerData[]) => Promise<boolean>;
  validateGameData: (gameState: GameData, playersState: PlayerData[]) => any;
}

export const useIntegrationTesting = () => {
  const [testResults, setTestResults] = useState<IntegrationTestSuite>({
    twoPhaseCommit: [],
    circuitBreaker: [],
    reconciliation: [],
    performance: [],
    dataValidation: []
  });
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Run Complete Integration Test Suite
  const runIntegrationTests = useCallback(async (testParams: RunTestsParams) => {
    setIsRunningTests(true);
    console.log('🧪 Iniciando testes de integração...');
    
    try {
      const results: IntegrationTestSuite = {
        twoPhaseCommit: await testTwoPhaseCommit(testParams.playPiece),
        circuitBreaker: await testCircuitBreaker(testParams.shouldAllowRequest, testParams.recordFailure),
        reconciliation: await testReconciliation(testParams.gameState, testParams.gameState, testParams.reconcileStates),
        performance: await testPerformance(testParams.validateGameData),
        dataValidation: []
      };

      setTestResults(results);
      
      // Calculate overall results
      const allTests = [
        ...results.twoPhaseCommit,
        ...results.circuitBreaker,
        ...results.reconciliation,
        ...results.performance
      ];
      
      const passed = allTests.filter(t => t.passed).length;
      const total = allTests.length;
      const successRate = total > 0 ? (passed / total) * 100 : 0;
      
      console.log(`✅ Testes concluídos: ${passed}/${total} (${successRate.toFixed(1)}%)`);
      toast.success(`Testes de integração: ${passed}/${total} passaram (${successRate.toFixed(1)}%)`);
      
      return results;
    } catch (error: any) {
      console.error('❌ Erro durante testes de integração:', error);
      toast.error('Erro durante execução dos testes');
      return null;
    } finally {
      setIsRunningTests(false);
    }
  }, []);

  // Get Test Summary
  const getTestSummary = useCallback(() => {
    const allTests = [
      ...testResults.twoPhaseCommit,
      ...testResults.circuitBreaker,
      ...testResults.reconciliation,
      ...testResults.performance,
      ...testResults.dataValidation
    ];
    
    const passed = allTests.filter(t => t.passed).length;
    const failed = allTests.filter(t => !t.passed).length;
    const avgDuration = allTests.length > 0 
      ? allTests.reduce((sum, t) => sum + t.duration, 0) / allTests.length 
      : 0;

    return {
      total: allTests.length,
      passed,
      failed,
      successRate: allTests.length > 0 ? (passed / allTests.length) * 100 : 0,
      averageDuration: avgDuration,
      testResults
    };
  }, [testResults]);

  return {
    runIntegrationTests,
    isRunningTests,
    testResults,
    getTestSummary
  };
};
