import { captureFiles } from './capture-layout';
import type { Comparison } from './compare-captures';
import { changed, type Difference } from './difference';
import {
  caseFails,
  evaluationRegressions,
  readEvaluation,
  rerunArguments,
  runEvaluation,
} from './evaluation';

export interface EvaluationComparison {
  /** The checkout the target was built from, where a flipped case is re-run. */
  readonly checkout: string | undefined;
  /** Whether the comparison was asked to cover the evaluation (--eval). */
  readonly requested: boolean;
}

/**
 * A case that passed in the baseline and fails now gets one re-run in the
 * checkout; if it fails again it is reported. Without a checkout it is
 * reported with the command that re-runs it. A case the target no longer has
 * is reported as missing. When the evaluation was asked for, a side without
 * a run — never evaluated, or skipped — is a difference, not a note.
 */
export async function compareEvaluations(
  baseline: string,
  target: string,
  { checkout, requested }: EvaluationComparison,
): Promise<Comparison> {
  const [before, after] = await Promise.all([
    readEvaluation(captureFiles(baseline).evaluation),
    readEvaluation(captureFiles(target).evaluation),
  ]);
  if (!before || !after) {
    const side = before ? 'the target' : 'the baseline';
    const detail = `${side} has no evaluation run`;
    return requested
      ? { differences: [{ location: 'evaluation', kind: 'missing', detail }], notes: [] }
      : { differences: [], notes: [`Evaluation not compared: ${detail}.`] };
  }
  const differences: Difference[] = [];
  for (const { id, kind } of evaluationRegressions(before, after)) {
    const difference =
      kind === 'missing'
        ? { location: `evaluation:${id}`, kind, detail: 'passed in the baseline, not run now' }
        : await confirmRegression(id, target, checkout);
    if (difference) differences.push(difference);
  }
  return { differences, notes: [] };
}

async function confirmRegression(
  id: string,
  target: string,
  checkout: string | undefined,
): Promise<Difference | null> {
  const location = `evaluation:${id}`;
  const command = `pnpm eval:assistant ${rerunArguments(id).join(' ')}`;
  if (!checkout) return changed(location, `passed in the baseline, fails now; re-run: ${command}`);
  const rerunDir = `${captureFiles(target).evaluation}-rerun-${encodeURIComponent(id)}`;
  const rerun = await runEvaluation(checkout, rerunArguments(id), rerunDir);
  if (rerun.kind === 'skipped') {
    return changed(location, `passed in the baseline, fails now; re-run skipped (${rerun.reason})`);
  }
  if (!caseFails(rerun.reports, id)) return null;
  return changed(location, `passed in the baseline, failed now and on its re-run (${command})`);
}
