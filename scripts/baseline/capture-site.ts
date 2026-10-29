import { access } from 'node:fs/promises';
import { captureAnswers } from './answers';
import { captureFiles } from './capture-layout';
import { checkoutState, runInCheckout, toolCommit } from './checkout';
import type { ProfileName } from './checkout-profile';
import { runEvaluation, type EvaluationOutcome } from './evaluation';
import type { BaselineInputs } from './inputs';
import { BASELINE_TOOL_VERSION, writeManifest, type CaptureManifest } from './manifest';
import { assertOutsideRepository, defaultBaselineDir } from './output-dir';
import { isLocalTarget, type Clock } from './pacing';
import { capturePages } from './pages';
import { makePrivateDir, readJson, writePrivateJson } from './private-files';
import { captureRoutes } from './routes';

/**
 * Captures what a running site answers to the baseline's inputs: its pages,
 * routes and fast-path answers over HTTP, and — given the checkout it was
 * built from — its retrieval results and, on request, an evaluation run.
 * Resumable: a second run keeps what the first one captured.
 */

export interface CaptureOptions {
  readonly target: URL;
  /** Defaults to PROFILE_HOME/baseline/<commit>/. */
  readonly out?: string | undefined;
  /** The checkout the target was built from; required to enumerate, search and evaluate. */
  readonly checkout?: string | undefined;
  /** Inputs to reuse, as a comparison reuses the baseline's. */
  readonly inputsFile?: string | undefined;
  readonly profile: ProfileName;
  readonly evaluation: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly clock: Clock;
}

interface Health {
  readonly commit: string | null;
  readonly model: string;
}

const HEALTH_TIMEOUT_MS = 30_000;

export class CaptureError extends Error {
  override name = 'CaptureError';
}

export async function capture(options: CaptureOptions): Promise<string> {
  const checkouts = options.checkout ? [options.checkout] : [];
  if (options.out) assertOutsideRepository(options.out, checkouts);
  const provenance = await provenanceOf(options);
  const dir = options.out ?? defaultBaselineDir(options.env, provenance.commit);
  assertOutsideRepository(dir, checkouts);
  await makePrivateDir(dir);
  await captureAll(dir, options);
  await writeManifest(dir, manifestOf(options, provenance, await evaluate(dir, options)));
  return dir;
}

interface Provenance {
  readonly commit: string;
  /** Unknown (null) for a deployment, which reports only its commit. */
  readonly dirty: boolean | null;
}

/** Which commit the target was built from: the checkout's, or what the deployment reports. */
async function provenanceOf({ target, checkout }: CaptureOptions): Promise<Provenance> {
  const health = await healthOf(target);
  if (isLocalTarget(target) && health.model === 'enabled') {
    throw new CaptureError(
      'The local server has the model enabled. Start it with OPENAI_API_KEY= so every answer ' +
        'captured is the fast path’s.',
    );
  }
  if (checkout) return checkoutState(checkout);
  if (!health.commit) {
    throw new CaptureError('The target does not report its commit: pass --checkout <dir>.');
  }
  return { commit: health.commit, dirty: null };
}

async function captureAll(dir: string, options: CaptureOptions): Promise<void> {
  const { target, clock } = options;
  const inputs = await inputsFor(dir, options);
  log(`Routes: ${String(inputs.routes.length)}`);
  await captureRoutes(inputs.routes, target, dir);
  log(`Pages: ${String(inputs.pages.length)}`);
  if (inputs.pages.length > 0) await capturePages(inputs.pages, target, dir);
  log(`Answers: ${String(inputs.answers.length)}`);
  await captureAnswers(inputs.answers, { target, dir, clock });
  if (options.checkout) await captureRetrieval(dir, options.checkout, options.profile, inputs);
}

async function inputsFor(dir: string, { checkout, inputsFile, profile }: CaptureOptions) {
  const file = captureFiles(dir).inputs;
  if (await exists(file)) return readJson<BaselineInputs>(file);
  if (inputsFile) {
    await writePrivateJson(file, await readJson<BaselineInputs>(inputsFile));
  } else if (checkout) {
    await runInCheckout(checkout, 'enumerate.mts', ['--profile', profile, '--out', file]);
  } else {
    throw new CaptureError('Nothing to ask: pass --checkout <dir> to enumerate the inputs.');
  }
  return readJson<BaselineInputs>(file);
}

async function captureRetrieval(
  dir: string,
  checkout: string,
  profile: ProfileName,
  inputs: BaselineInputs,
) {
  const files = captureFiles(dir);
  log(`Retrieval probes: ${String(inputs.retrievalProbes.length)}`);
  if (inputs.retrievalProbes.length === 0) {
    await writePrivateJson(files.retrieval, []);
    return;
  }
  await runInCheckout(checkout, 'retrieve.mts', [
    '--profile',
    profile,
    '--inputs',
    files.inputs,
    '--out',
    files.retrieval,
  ]);
}

async function evaluate(dir: string, { checkout, evaluation }: CaptureOptions) {
  if (!evaluation) return null;
  if (!checkout)
    throw new CaptureError('The evaluation runs in the checkout: pass --checkout <dir>.');
  log('Evaluation: pnpm eval:assistant --runs 1');
  return runEvaluation(checkout, ['--runs', '1'], captureFiles(dir).evaluation);
}

function manifestOf(
  { target, checkout }: CaptureOptions,
  { commit, dirty }: Provenance,
  evaluation: EvaluationOutcome | null,
): CaptureManifest {
  return {
    commit,
    dirty,
    date: new Date().toISOString(),
    target: target.href,
    tool: { version: BASELINE_TOOL_VERSION, commit: toolCommit() },
    retrieval: Boolean(checkout),
    evaluation: evaluation?.kind ?? 'not-run',
  };
}

async function healthOf(target: URL): Promise<Health> {
  const response = await fetch(new URL('/api/health', target), {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new CaptureError(`${target.href} answered ${String(response.status)} to /api/health.`);
  }
  return (await response.json()) as Health;
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function log(line: string): void {
  console.log(line);
}
