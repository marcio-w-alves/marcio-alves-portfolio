import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { caseGrade, type CaseReport } from '../evaluation/report';
import { fileOf } from './capture-layout';
import { makePrivateDir } from '../profile/home';
import { writePrivateJson } from './private-files';
import { gitEnvironment } from './git-environment';

/**
 * The model path cannot be held to identical answers, so the baseline keeps
 * the evaluation's verdicts instead, case by case. Every run is gpt-4o-mini,
 * for the assistant and for the judge, once per case: the owner's standing
 * rule for what an evaluation may spend.
 */

const EVALUATION_MODEL = 'gpt-4o-mini';
const EVALUATION_TIMEOUT_MS = 60 * 60 * 1000;
/** Where `pnpm eval:assistant` writes its full report, inside the temporary directory it is given. */
const REPORT_NAME = 'assistant-evaluation.json';

export type EvaluationOutcome =
  | { readonly kind: 'run'; readonly reports: readonly CaseReport[] }
  | { readonly kind: 'skipped'; readonly reason: string };

/** A case that passed in the baseline and now fails, or is no longer there. */
export interface EvaluationRegression {
  readonly id: string;
  readonly kind: 'fails' | 'missing';
}

export function evaluationRegressions(
  baseline: readonly CaseReport[],
  current: readonly CaseReport[],
): EvaluationRegression[] {
  const now = new Map(current.map((report) => [report.id, report]));
  return baseline
    .filter((report) => caseGrade(report).passes)
    .flatMap(({ id }): EvaluationRegression[] => {
      const report = now.get(id);
      if (!report) return [{ id, kind: 'missing' }];
      return caseGrade(report).passes ? [] : [{ id, kind: 'fails' }];
    });
}

export function caseFails(reports: readonly CaseReport[], id: string): boolean {
  const report = reports.find((candidate) => candidate.id === id);
  return !report || !caseGrade(report).passes;
}

/** The one re-run a case that flipped gets: still failing, it is a regression the owner decides on. */
export function rerunArguments(id: string): string[] {
  return ['--only', id, '--runs', '1'];
}

/**
 * Runs `pnpm eval:assistant` in the checkout and keeps its report in
 * `destination`, whole and one file per case. Without a report — the judge
 * failed calibration, or the run broke — the evaluation is recorded as skipped,
 * never re-run with another model.
 */
export async function runEvaluation(
  checkout: string,
  args: readonly string[],
  destination: string,
): Promise<EvaluationOutcome> {
  await makePrivateDir(destination);
  // Not under the destination: tsx opens a Unix socket in the temporary
  // directory, and a socket path past 104 bytes cannot be bound on macOS.
  // mkdtemp makes it private to the owner, and it is removed below.
  const scratch = await mkdtemp(join(tmpdir(), 'portfolio-eval-'));
  try {
    const exitCode = await evaluate(checkout, args, scratch);
    const reports = await readReport(join(scratch, REPORT_NAME));
    if (!reports) {
      const outcome = {
        kind: 'skipped',
        reason: `no report (exit code ${String(exitCode)})`,
      } as const;
      await writePrivateJson(join(destination, 'skipped.json'), outcome);
      return outcome;
    }
    await writePrivateJson(join(destination, 'report.json'), reports);
    await Promise.all(
      reports.map((report) =>
        writePrivateJson(join(destination, 'cases', fileOf(report.id, '.json')), report),
      ),
    );
    return { kind: 'run', reports };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

function evaluate(
  checkout: string,
  args: readonly string[],
  scratch: string,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['eval:assistant', ...args], {
      cwd: checkout,
      stdio: 'inherit',
      timeout: EVALUATION_TIMEOUT_MS,
      env: {
        ...gitEnvironment(),
        // os.tmpdir() reads it, so the report lands in this run's own folder.
        TMPDIR: scratch,
        OPENAI_CHAT_MODEL: EVALUATION_MODEL,
        EVAL_JUDGE_MODEL: EVALUATION_MODEL,
      },
    });
    child.on('error', reject);
    child.on('close', resolve);
  });
}

async function readReport(path: string): Promise<CaseReport[] | null> {
  const text = await readFile(path, 'utf8').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
  return text === null ? null : (JSON.parse(text) as CaseReport[]);
}

export async function readEvaluation(destination: string): Promise<readonly CaseReport[] | null> {
  return readReport(join(destination, 'report.json'));
}
