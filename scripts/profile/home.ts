import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironment } from '../baseline/git-environment';

/**
 * The owner's local home for profile data — bundles, backups, baselines —
 * which holds personal data and so lives outside the repository. The tools
 * refuse to write it inside any work tree of this repository: the guarantee
 * is that they cannot, not that `.gitignore` would hide it.
 */

type Env = Readonly<Record<string, string | undefined>>;

const PRIVATE_DIR = 0o700;
const PRIVATE_FILE = 0o600;
const GIT_TIMEOUT_MS = 10_000;
const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

export class HomeInsideRepositoryError extends Error {
  constructor(home: string, workTree: string) {
    super(
      `Refusing to use ${home} as PROFILE_HOME: it is inside the git work tree ${workTree}, and ` +
        'profile data (bundles, backups) is kept outside the repository. Set PROFILE_HOME to a ' +
        'directory elsewhere, or leave it unset.',
    );
    this.name = 'HomeInsideRepositoryError';
  }
}

/** `PROFILE_HOME`, else `${XDG_DATA_HOME:-~/.local/share}/portfolio-profile`. */
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

/**
 * Creates `PROFILE_HOME/<area>` readable by its owner alone, after checking it
 * is outside the repository, and returns its path.
 */
export async function privateHomeDir(env: Env, area: string): Promise<string> {
  const home = profileHome(env);
  const workTree = workTreeContaining(home);
  if (workTree !== undefined) throw new HomeInsideRepositoryError(home, workTree);
  const dir = join(home, area);
  await makePrivateDir(dir);
  return dir;
}

export async function makePrivateDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: PRIVATE_DIR });
}

export async function writePrivateFile(path: string, data: string | Uint8Array): Promise<void> {
  await makePrivateDir(dirname(path));
  await writeFile(path, data, { mode: PRIVATE_FILE });
}

/**
 * The work tree of this repository — or of one of `checkouts` — that `target`
 * lies in once every symlink on its way is resolved, if any.
 */
export function workTreeContaining(
  target: string,
  checkouts: readonly string[] = [],
): string | undefined {
  const resolved = resolveThroughSymlinks(resolve(target));
  return protectedWorkTrees([TOOL_DIR, ...checkouts]).find(
    (workTree) => resolved === workTree || resolved.startsWith(workTree + sep),
  );
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

/**
 * Git could not say where the repository's work trees are, so no path can be
 * shown to lie outside them.
 */
export class WorkTreesUnknownError extends Error {
  constructor(path: string, cause: unknown) {
    super(
      'Cannot tell which directories belong to this repository: listing its work trees failed in ' +
        `${path}. Profile data is written only where it is known to be outside the repository, so ` +
        'this command stops here. Run it from a checkout of this repository, with git available.',
      { cause },
    );
    this.name = 'WorkTreesUnknownError';
  }
}

/** Every work tree of the repository `path` belongs to: its main checkout and each linked one. */
function workTreesOf(path: string): string[] {
  let listing: string;
  try {
    listing = execFileSync('git', ['-C', path, 'worktree', 'list', '--porcelain'], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: gitEnvironment(),
    });
  } catch (error) {
    throw new WorkTreesUnknownError(path, error);
  }
  return listing
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));
}
