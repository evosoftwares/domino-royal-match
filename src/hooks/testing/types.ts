
export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface IntegrationTestSuite {
  twoPhaseCommit: TestResult[];
  circuitBreaker: TestResult[];
  reconciliation: TestResult[];
  performance: TestResult[];
  dataValidation: TestResult[];
}
