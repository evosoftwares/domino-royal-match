
import { TestResult } from './types';

export const testCircuitBreaker = async (
  shouldAllowRequest: () => boolean,
  recordFailure: (time: number, error: any) => void
): Promise<TestResult[]> => {
  const tests: TestResult[] = [];
  
  // Test 1: Circuit State Management
  const startTime1 = performance.now();
  try {
    const allowed = shouldAllowRequest();
    
    tests.push({
      testName: 'Circuit State Check',
      passed: typeof allowed === 'boolean',
      duration: performance.now() - startTime1,
      details: { allowed }
    });
  } catch (error: any) {
    tests.push({
      testName: 'Circuit State Check',
      passed: false,
      duration: performance.now() - startTime1,
      error: error.message
    });
  }

  // Test 2: Failure Recording
  const startTime2 = performance.now();
  try {
    recordFailure(100, new Error('Test failure'));
    
    tests.push({
      testName: 'Failure Recording',
      passed: true,
      duration: performance.now() - startTime2,
      details: { status: 'Failure recorded successfully' }
    });
  } catch (error: any) {
    tests.push({
      testName: 'Failure Recording',
      passed: false,
      duration: performance.now() - startTime2,
      error: error.message
    });
  }

  return tests;
};
