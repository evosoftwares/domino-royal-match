
import { GameData, PlayerData } from '@/types/game';
import { TestResult } from './types';

export const testPerformance = async (
  validateGameData: (gameState: GameData, playersState: PlayerData[]) => any
): Promise<TestResult[]> => {
  const tests: TestResult[] = [];
  
  // Test 1: Validation Performance
  const startTime1 = performance.now();
  try {
    const mockGameState: GameData = {
      id: 'test-game',
      status: 'active',
      board_state: { pieces: [] },
      current_player_turn: 'test-player',
      created_at: new Date().toISOString(),
      prize_pool: 4.40,
      consecutive_passes: 0
    };
    
    const result = validateGameData(mockGameState, []);
    const duration = performance.now() - startTime1;
    
    tests.push({
      testName: 'Validation Performance',
      passed: duration < 100, // Should complete under 100ms
      duration,
      details: { validationTime: duration, result }
    });
  } catch (error: any) {
    tests.push({
      testName: 'Validation Performance',
      passed: false,
      duration: performance.now() - startTime1,
      error: error.message
    });
  }

  return tests;
};
