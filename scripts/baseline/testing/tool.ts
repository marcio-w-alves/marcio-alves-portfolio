import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { capture } from '../capture-site';
import type { BaselineInputs } from '../inputs';
import { systemClock } from '../pacing';

const run = promisify(execFile);

export const REPOSITORY = fileURLToPath(new URL('../../..', import.meta.url));
const TSX = join(REPOSITORY, 'node_modules', '.bin', 'tsx');
const CLI_TIMEOUT_MS = 60_000;

/** A test that starts the tool as its own process takes seconds when the whole suite is running. */
export const TOOL_TEST_TIMEOUT_MS = 30_000;

export interface ToolRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs one of the tool's commands as the owner does, in its own process. */
export async function runTool(
  script: 'capture.mts' | 'compare.mts' | 'enumerate.mts',
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
): Promise<ToolRun> {
  try {
    const { stdout, stderr } = await run(
      TSX,
      [join(REPOSITORY, 'scripts', 'baseline', script), ...args],
      {
        cwd: REPOSITORY,
        env: { ...process.env, ...env },
        timeout: CLI_TIMEOUT_MS,
      },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.code !== 'number') throw error;
    return { code: failed.code, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' };
  }
}

/** A fresh directory outside the repository, removed by the returned function. */
export async function scratchDir(): Promise<{
  readonly path: string;
  readonly remove: () => Promise<void>;
}> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'baseline-test-')));
  return { path, remove: () => rm(path, { recursive: true, force: true }) };
}

export async function writeInputs(dir: string, inputs: BaselineInputs): Promise<string> {
  const file = join(dir, 'inputs.json');
  await writeFile(file, JSON.stringify(inputs));
  return file;
}

/** A capture of a running server, taken the way the owner takes one, from this checkout. */
export function captureOf(target: URL, inputsFile: string, out: string): Promise<string> {
  return capture({
    target,
    out,
    checkout: REPOSITORY,
    inputsFile,
    profile: 'fixture',
    evaluation: false,
    env: {},
    clock: systemClock,
  });
}
