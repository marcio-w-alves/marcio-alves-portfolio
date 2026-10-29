/**
 * Compares a site with the baseline (design §6, FR-30): every difference by
 * input and place, exit 0 only when there is none. Either captures a running
 * target with the baseline's inputs first, or compares a capture already
 * taken. With --eval, also evaluates the target and re-runs, once, every case
 * that passed in the baseline and fails now.
 *
 *   pnpm baseline:compare --baseline <dir> --target <url> [--checkout <dir>] [--out <dir>]
 *     [--profile owner|fixture] [--eval]
 *   pnpm baseline:compare --baseline <dir> --capture <dir>
 *
 * A target captured without --checkout (a deployment) has no retrieval
 * results; that is a difference unless --without-retrieval accepts it.
 */
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { capture } from './capture-site';
import { captureFiles } from './capture-layout';
import { isProfileName } from './checkout-profile';
import { assertProfileAllowedHere } from './ci-guard';
import { compareCaptures } from './compare-captures';
import { compareEvaluations } from './compare-evaluations';
import { formatDifference } from './difference';
import { readManifest } from './manifest';
import { profileHome } from '../profile/home';
import { systemClock } from './pacing';

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    target: { type: 'string' },
    capture: { type: 'string' },
    checkout: { type: 'string' },
    out: { type: 'string' },
    profile: { type: 'string', default: 'owner' },
    eval: { type: 'boolean', default: false },
    'without-retrieval': { type: 'boolean', default: false },
  },
});

async function targetCapture(baseline: string): Promise<string> {
  if (values.capture) return resolve(values.capture);
  if (!values.target) throw new Error('Pass --target <url> or --capture <dir>.');
  if (!isProfileName(values.profile)) throw new Error(`Unknown profile "${values.profile}".`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return capture({
    target: new URL(values.target),
    out: resolve(values.out ?? join(profileHome(process.env), 'comparisons', stamp)),
    checkout: values.checkout && resolve(values.checkout),
    inputsFile: captureFiles(baseline).inputs,
    profile: values.profile,
    evaluation: values.eval,
    env: process.env,
    clock: systemClock,
  });
}

try {
  assertProfileAllowedHere(values.profile, process.env);
  if (!values.baseline) throw new Error('Pass --baseline <dir>.');
  const baseline = resolve(values.baseline);
  const { commit, date } = await readManifest(baseline);
  const target = await targetCapture(baseline);
  await readManifest(target);
  const captures = await compareCaptures(baseline, target, {
    withoutRetrieval: values['without-retrieval'],
  });
  const evaluations = await compareEvaluations(baseline, target, {
    checkout: values.checkout && resolve(values.checkout),
    requested: values.eval,
  });
  const differences = [...captures.differences, ...evaluations.differences];
  for (const difference of differences) console.log(formatDifference(difference));
  for (const note of [...captures.notes, ...evaluations.notes]) console.log(`note: ${note}`);
  console.log(
    `${String(differences.length)} difference(s) from the baseline of ${commit} (${date}); target: ${target}`,
  );
  process.exitCode = differences.length === 0 ? 0 : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
