import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CaseReport, RunReport } from '../evaluation/report';
import { evaluationRegressions, rerunArguments, runEvaluation } from './evaluation';
import { readJson } from './private-files';
import { scratchDir } from './testing/tool';

const run = (failures: string[] = []): RunReport => ({
  path: 'model',
  ms: 900,
  failures,
  trace: [],
});
const report = (id: string, ...runs: RunReport[]): CaseReport => ({
  id,
  category: 'grounding',
  question: `Question ${id}?`,
  runs,
});
const passing = (id: string) => report(id, run());
const failing = (id: string) => report(id, run(['unsupported: a claim']));

describe('cases that regressed since the baseline', () => {
  it('flags only cases that passed in the baseline and fail now, for one targeted re-run', () => {
    const baseline = [
      passing('flips'),
      passing('holds'),
      failing('still-fails'),
      failing('recovers'),
    ];
    const current = [
      failing('flips'),
      passing('holds'),
      failing('still-fails'),
      passing('recovers'),
    ];

    const regressions = evaluationRegressions(baseline, current);

    expect(regressions).toEqual(['flips']);
    expect(regressions.map(rerunArguments)).toEqual([['--only', 'flips', '--runs', '1']]);
  });
});

/**
 * A stand-in checkout whose `eval:assistant` writes the report the real one
 * does, where the real one does — `os.tmpdir()` — and records which models
 * it was told to use. No model is called.
 */
describe('running the evaluation in a checkout', () => {
  let scratch: Awaited<ReturnType<typeof scratchDir>>;
  let checkout: string;

  beforeEach(async () => {
    scratch = await scratchDir();
    checkout = join(scratch.path, 'checkout');
    await mkdir(checkout);
  });
  afterEach(async () => {
    await scratch.remove();
  });

  async function standIn(script: string) {
    await writeFile(
      join(checkout, 'package.json'),
      JSON.stringify({
        name: 'stand-in',
        private: true,
        scripts: { 'eval:assistant': 'node evaluate.mjs' },
      }),
    );
    await writeFile(join(checkout, 'evaluate.mjs'), script);
  }

  it('keeps the report whole and case by case, run with gpt-4o-mini for the assistant and the judge', async () => {
    await standIn(`
      import { writeFileSync } from 'node:fs';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      const models = { chat: process.env.OPENAI_CHAT_MODEL, judge: process.env.EVAL_JUDGE_MODEL };
      const reports = ['identity', 'leadership'].map((id) => ({
        id, category: 'grounding', question: id, args: process.argv.slice(2), models,
        runs: [{ path: 'fast', ms: 1, failures: [], trace: [] }],
      }));
      writeFileSync(join(tmpdir(), 'assistant-evaluation.json'), JSON.stringify(reports));
    `);
    const destination = join(scratch.path, 'evaluation');

    const outcome = await runEvaluation(checkout, ['--runs', '1'], destination);

    expect(outcome.kind).toBe('run');
    expect((await readdir(join(destination, 'cases'))).sort()).toEqual([
      'identity.json',
      'leadership.json',
    ]);
    const identity = await readJson(join(destination, 'cases', 'identity.json'));
    expect(identity).toMatchObject({
      args: ['--runs', '1'],
      models: { chat: 'gpt-4o-mini', judge: 'gpt-4o-mini' },
    });
    expect(await readJson(join(destination, 'report.json'))).toHaveLength(2);
  });

  it('records the evaluation as skipped when the run leaves no report, as a failed calibration does', async () => {
    await standIn(`
      console.error('The judge failed calibration; its verdicts cannot be trusted.');
      process.exit(1);
    `);
    const destination = join(scratch.path, 'evaluation');

    const outcome = await runEvaluation(checkout, ['--runs', '1'], destination);

    expect(outcome).toEqual({ kind: 'skipped', reason: 'no report (exit code 1)' });
    expect(await readJson(join(destination, 'skipped.json'))).toEqual(outcome);
  });
});
