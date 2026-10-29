import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where baselines go, and where they may never go. A baseline holds the
 * owner's pages, answers and files, so the tool refuses to write one inside
 * any work tree of this repository — the guarantee is that it cannot, not
 * that `.gitignore` would hide it.
 */

export const OUTSIDE_REPOSITORY_RULE = 'baselines are written outside the repository';

export class OutputInsideRepositoryError extends Error {
  constructor(target: string, workTree: string) {
    super(
      `Refusing to write to ${target}: it is inside the git work tree ${workTree}, and ` +
        `${OUTSIDE_REPOSITORY_RULE} (they hold the owner's personal data). ` +
        'Leave --out unset to write under PROFILE_HOME/baseline/.',
    );
    this.name = 'OutputInsideRepositoryError';
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const GIT_TIMEOUT_MS = 10_000;
const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

/** The owner's local home for profile data: `${XDG_DATA_HOME:-~/.local/share}/portfolio-profile`. */
export function profileHome(env: Env): string {
  if (env.PROFILE_HOME) return resolve(env.PROFILE_HOME);
  return join(dataHome(env), 'portfolio-profile');
}

function dataHome({ XDG_DATA_HOME }: Env): string {
  // The XDG spec treats an empty value as unset.
  if (XDG_DATA_HOME === undefined || XDG_DATA_HOME === '')
    return join(homedir(), '.local', 'share');
  return XDG_DATA_HOME;
}

export function defaultBaselineDir(env: Env, commit: string): string {
  return join(profileHome(env), 'baseline', commit);
}

/**
 * Throws unless `target`, with every symlink on its way resolved, is outside
 * every work tree of this repository and of the checkout being captured.
 */
export function assertOutsideRepository(target: string, checkouts: readonly string[] = []): void {
  const resolved = resolveThroughSymlinks(resolve(target));
  for (const workTree of protectedWorkTrees([TOOL_DIR, ...checkouts])) {
    if (resolved === workTree || resolved.startsWith(workTree + sep)) {
      throw new OutputInsideRepositoryError(target, workTree);
    }
  }
}

/**
 * The real path of the deepest existing ancestor, with the not-yet-created
 * rest appended. The native call returns the casing on disk, so a path typed
 * in another case on a case-insensitive file system still matches the work
 * tree it is in.
 */
function resolveThroughSymlinks(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    const parent = dirname(path);
    if (parent === path) return path;
    return join(resolveThroughSymlinks(parent), basename(path));
  }
}

function protectedWorkTrees(insideRepositories: readonly string[]): string[] {
  return [...new Set(insideRepositories.flatMap(workTreesOf))].map(resolveThroughSymlinks);
}

/** Every work tree of the repository `path` belongs to: its main checkout and each linked one. */
function workTreesOf(path: string): string[] {
  const listing = execFileSync('git', ['-C', path, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
  });
  return listing
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));
}
