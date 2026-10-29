import type { EvaluationCase } from '../../src/profile/evaluation';

/**
 * A model answer varies from run to run, so one run proves little either way.
 * A case is run several times and passes when at least two thirds of its runs
 * do: an occasional slip is tolerated, a habit is not.
 */

export interface Grade {
  readonly passed: number;
  readonly runs: number;
  readonly required: number;
  readonly passes: boolean;
}

export function requiredPasses(runs: number): number {
  return Math.ceil((2 * runs) / 3);
}

export function grade(runResults: readonly boolean[]): Grade {
  const passed = runResults.filter(Boolean).length;
  const required = requiredPasses(runResults.length);
  return { passed, runs: runResults.length, required, passes: passed >= required };
}

/** The fast path is deterministic: running it again would only repeat the answer. */
export function runsFor(testCase: EvaluationCase, runs: number): number {
  return testCase.expect.path === 'fast' ? 1 : runs;
}
