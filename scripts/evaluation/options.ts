import { parseArgs } from 'node:util';
import type { EvaluationCase } from './cases';

export interface EvaluationOptions {
  /** How many times each model-path case runs. */
  readonly runs: number;
  /** Case ids or categories to run; empty runs them all. */
  readonly only: readonly string[];
}

const DEFAULT_RUNS = 3;

/**
 * Reads `--runs <n>` (or `EVAL_RUNS`) and `--only <id|category,…>`.
 * A leading `--` is what pnpm forwards from `pnpm eval:assistant -- …`.
 */
export function parseOptions(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): EvaluationOptions {
  const { values } = parseArgs({
    args: args[0] === '--' ? args.slice(1) : [...args],
    options: { runs: { type: 'string' }, only: { type: 'string' } },
  });
  const runs = values.runs ?? env.EVAL_RUNS;
  return {
    runs: runs === undefined || runs === '' ? DEFAULT_RUNS : positiveInteger(runs),
    only: (values.only ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  };
}

function positiveInteger(text: string): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`The number of runs must be a positive integer, got "${text}".`);
  }
  return value;
}

/** Narrows the cases to the named ids and categories; a name that matches nothing is a typo. */
export function selectCases(
  cases: readonly EvaluationCase[],
  only: readonly string[],
): readonly EvaluationCase[] {
  if (only.length === 0) return cases;
  const unknown = only.filter(
    (name) => !cases.some(({ id, category }) => id === name || category === name),
  );
  if (unknown.length > 0) {
    throw new Error(
      `No case or category is named ${unknown.map((name) => `"${name}"`).join(', ')}.`,
    );
  }
  return cases.filter(({ id, category }) => only.includes(id) || only.includes(category));
}
