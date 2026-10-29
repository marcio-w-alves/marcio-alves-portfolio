import { join } from 'node:path';
import { profileHome, workTreeContaining } from '../profile/home';

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

export function defaultBaselineDir(env: Env, commit: string): string {
  return join(profileHome(env), 'baseline', commit);
}

/**
 * Throws unless `target`, with every symlink on its way resolved, is outside
 * every work tree of this repository and of the checkout being captured.
 */
export function assertOutsideRepository(target: string, checkouts: readonly string[] = []): void {
  const workTree = workTreeContaining(target, checkouts);
  if (workTree !== undefined) throw new OutputInsideRepositoryError(target, workTree);
}
