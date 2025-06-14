
import { GameData, PlayerData } from '@/types/game';
import { TestResult } from './types';
import {
  StrictGameState,
  StrictPlayerState,
} from '../useTypeScriptStrictMode';

export interface ValidationFunctions {
  toStrictGameState: (gameData: any) => StrictGameState;
  toStrictPlayersState: (playersData: any[]) => ReadonlyArray<StrictPlayerState>;
  validateStateConsistency: (
    gameState: StrictGameState,
    playersState: ReadonlyArray<StrictPlayerState>
  ) => void;
}

export const testDataValidation = async (
  gameState: GameData,
  playersState: PlayerData[],
  validationFunctions: ValidationFunctions
): Promise<TestResult[]> => {
  const tests: TestResult[] = [];
  const {
    toStrictGameState,
    toStrictPlayersState,
    validateStateConsistency,
  } = validationFunctions;

  // Test 1: Game State Conversion
  const startTime1 = performance.now();
  let strictGameState: StrictGameState | null = null;
  try {
    strictGameState = toStrictGameState(gameState);
    tests.push({
      testName: 'Game State to Strict Format',
      passed: true,
      duration: performance.now() - startTime1,
      details: { converted: true },
    });
  } catch (error: any) {
    tests.push({
      testName: 'Game State to Strict Format',
      passed: false,
      duration: performance.now() - startTime1,
      error: error.message,
    });
  }

  // Test 2: Players State Conversion
  const startTime2 = performance.now();
  let strictPlayersState: ReadonlyArray<StrictPlayerState> | null = null;
  try {
    strictPlayersState = toStrictPlayersState(playersState);
    tests.push({
      testName: 'Players State to Strict Format',
      passed: true,
      duration: performance.now() - startTime2,
      details: { converted: true },
    });
  } catch (error: any) {
    tests.push({
      testName: 'Players State to Strict Format',
      passed: false,
      duration: performance.now() - startTime2,
      error: error.message,
    });
  }

  // Test 3: State Consistency
  if (strictGameState && strictPlayersState) {
    const startTime3 = performance.now();
    try {
      validateStateConsistency(strictGameState, strictPlayersState);
      tests.push({
        testName: 'Overall State Consistency',
        passed: true,
        duration: performance.now() - startTime3,
        details: { status: 'Consistent' },
      });
    } catch (error: any) {
      tests.push({
        testName: 'Overall State Consistency',
        passed: false,
        duration: performance.now() - startTime3,
        error: error.message,
      });
    }
  }

  return tests;
};
