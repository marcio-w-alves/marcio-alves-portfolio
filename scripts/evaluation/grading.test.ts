import { describe, expect, it } from 'vitest';
import type { EvaluationCase } from './cases';
import { grade, requiredPasses, runsFor } from './grading';

describe('grading a case over several runs', () => {
  it('passes a case at two of three runs and fails it at one', () => {
    expect(grade([true, true, false]).passes).toBe(true);
    expect(grade([true, false, false]).passes).toBe(false);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [5, 4],
    [6, 4],
  ])('needs ⌈2N/3⌉ passing runs: %i runs need %i', (runs, needed) => {
    expect(requiredPasses(runs)).toBe(needed);
  });

  it('fails a five-run case that passed only three times', () => {
    expect(grade([true, true, true, false, false])).toEqual({
      passed: 3,
      runs: 5,
      required: 4,
      passes: false,
    });
  });
});

describe('how many times a case runs', () => {
  const question = { id: 'q', category: 'career', question: 'Q?' } as const;

  it('runs a fast-path case once, since its answer is deterministic', () => {
    const fast: EvaluationCase = { ...question, expect: { path: 'fast' } };
    expect(runsFor(fast, 3)).toBe(1);
  });

  it('runs a case that can reach the model the requested number of times', () => {
    const model: EvaluationCase = { ...question, expect: { path: 'model' } };
    const either: EvaluationCase = { ...question, expect: {} };
    expect(runsFor(model, 3)).toBe(3);
    expect(runsFor(either, 5)).toBe(5);
  });
});
