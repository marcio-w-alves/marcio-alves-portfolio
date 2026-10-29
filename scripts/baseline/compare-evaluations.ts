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

/**
 * A case that passed in the baseline and fails now gets one re-run in the
 * checkout; if it fails again it is reported. Without a checkout it is
 * reported with the command that re-runs it.
 */
export async function compareEvaluations(
  baseline: string,
  target: string,
  checkout: string | undefined,
): Promise<Comparison> {
  const [before, after] = await Promise.all([
    readEvaluation(captureFiles(baseline).evaluation),
    readEvaluation(captureFiles(target).evaluation),
  ]);
  if (!before || !after) {
    return { differences: [], notes: ['Evaluation not compared: a side has no evaluation run.'] };
  }
  const differences: Difference[] = [];
  for (const id of evaluationRegressions(before, after)) {
    const difference = await confirmRegression(id, target, checkout);
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
