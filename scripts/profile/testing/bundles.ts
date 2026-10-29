import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse, stringify } from 'yaml';
import { decodeBundle } from '../bundle/decode';
import { formatProblem, ProfileProblemsError } from '../bundle/problems';
import type { KnowledgeSource } from '../../../src/core/knowledge/schema';
import { checkProfile, type CheckedProfile } from '../checks';
import { seededIndex } from '../seeded-index';
import { bundleDirectory } from '../workspace/bundle-directory';

/**
 * Real bundles on disk for the tests: a copy of the shipped example with one
 * edit applied, read and checked the way every command reads a profile.
 */

export const REPOSITORY = fileURLToPath(new URL('../../..', import.meta.url));
export const EXAMPLE_DIR = join(REPOSITORY, 'profiles', 'example');

export interface Scratch {
  readonly path: string;
  readonly remove: () => Promise<void>;
}

/** A fresh directory outside the repository. */
export async function scratchDir(prefix = 'profile-test-'): Promise<Scratch> {
  const path = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  return { path, remove: () => rm(path, { recursive: true, force: true }) };
}

/** A copy of the example bundle in `scratch`, at `scratch/bundle`. */
export async function exampleCopy(scratch: Scratch): Promise<string> {
  const dir = join(scratch.path, 'bundle');
  await cp(EXAMPLE_DIR, dir, { recursive: true });
  return dir;
}

export async function writeDocument(dir: string, path: string, content: string | Uint8Array) {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), content);
}

/** Parses a YAML or JSON document of the bundle, lets `edit` change it, and writes it back. */
export async function editDocument(dir: string, path: string, edit: (value: never) => void) {
  const file = join(dir, path);
  const text = await readFile(file, 'utf8');
  const isJson = path.endsWith('.json');
  const value: unknown = isJson ? JSON.parse(text) : parse(text);
  edit(value as never);
  await writeFile(file, isJson ? `${JSON.stringify(value)}\n` : stringify(value));
}

/**
 * Rebuilds the bundle's index after a test edited its record, so the check
 * that would report the stale index stays out of a test about something else.
 */
export async function reseedIndex(dir: string) {
  const { profile } = await bundleDirectory(dir).read();
  const { knowledge } = decodeBundle(profile.documents).data;
  await writeFile(
    join(dir, 'generated/knowledge-index.json'),
    seededIndex(knowledge as KnowledgeSource),
  );
}

/** Reads and checks a bundle as `pnpm profile check` does. */
export async function checkBundle(dir: string): Promise<CheckedProfile> {
  const { profile } = await bundleDirectory(dir).read();
  return checkProfile(decodeBundle(profile.documents));
}

/** Every problem reading and checking the bundle finds, formatted as the commands print them. */
export async function problemsOf(dir: string): Promise<string[]> {
  try {
    await checkBundle(dir);
    return [];
  } catch (error) {
    if (error instanceof ProfileProblemsError) return error.problems.map(formatProblem);
    throw error;
  }
}

const run = promisify(execFile);
const TSX = join(REPOSITORY, 'node_modules', '.bin', 'tsx');

/** A test that starts the command as its own process takes seconds when the whole suite runs. */
export const CLI_TEST_TIMEOUT_MS = 30_000;

export interface CommandRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Runs `pnpm profile <args>` in its own process. The environment is the given
 * one alone (plus PATH and HOME), so a variable of the machine running the
 * tests cannot pick the profile.
 */
export async function runProfile(
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
): Promise<CommandRun> {
  return runScript(join(REPOSITORY, 'scripts', 'profile.mts'), args, env);
}

/** Writes a bundle's notes, seeded index and probe embeddings, as the example's are written. */
export async function runExampleBuilder(dir: string): Promise<CommandRun> {
  return runScript(join(REPOSITORY, 'scripts', 'example', 'generate-example-files.mts'), [dir]);
}

async function runScript(
  script: string,
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
): Promise<CommandRun> {
  try {
    const { stdout, stderr } = await run(TSX, [script, ...args], {
      cwd: REPOSITORY,
      env: { NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, ...env },
      timeout: CLI_TEST_TIMEOUT_MS,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    if (typeof failed.code !== 'number') throw error;
    return { code: failed.code, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' };
  }
}
