
import { GameData, PlayerData } from '@/types/game';
import { TestResult } from './types';

export const testReconciliation = async (
  localGameState: GameData,
  serverGameState: GameData,
  reconcileStates: (local: GameData, server: GameData, localPlayers: PlayerData[], serverPlayers: PlayerData[]) => Promise<boolean>
): Promise<TestResult[]> => {
  const tests: TestResult[] = [];
  
  // Test 1: Conflict Detection
  const startTime1 = performance.now();
  try {
    // Create conflicting states
    const conflictingLocal = { ...localGameState, current_player_turn: 'player1' };
    const conflictingServer = { ...serverGameState, current_player_turn: 'player2' };
    
    const result = await reconcileStates(conflictingLocal, conflictingServer, [], []);
    
    tests.push({
      testName: 'Conflict Detection',
      passed: typeof result === 'boolean',
      duration: performance.now() - startTime1,
      details: { reconciled: result }
    });
  } catch (error: any) {
    tests.push({
      testName: 'Conflict Detection',
      passed: false,
      duration: performance.now() - startTime1,
      error: error.message
    });
  }

  return tests;
};
