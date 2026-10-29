/**
 * What is wrong with a profile, said where it is and what to do about it, so
 * the owner can fix every problem in one pass instead of one per run.
 */
export interface BundleProblem {
  /** The bundle path of the document, e.g. `knowledge/experience.yaml`. */
  readonly document: string;
  /** A JSON Pointer into the document, e.g. `/experience/0/start`, or a `line:col` position. */
  readonly at?: string;
  readonly problem: string;
  readonly remedy: string;
}

export function formatProblem({ document, at, problem, remedy }: BundleProblem): string {
  return `${document}${at === undefined ? '' : `#${at}`}: ${problem} — ${remedy}`;
}

/** Thrown when a profile cannot be used; its message lists every problem, one per line. */
export class ProfileProblemsError extends Error {
  constructor(readonly problems: readonly BundleProblem[]) {
    super(
      `The profile has ${String(problems.length)} problem${problems.length === 1 ? '' : 's'}:\n` +
        problems.map((problem) => `  ${formatProblem(problem)}`).join('\n'),
    );
    this.name = 'ProfileProblemsError';
  }
}

/** A JSON Pointer (RFC 6901) for a path of keys and indexes. */
export function pointer(path: readonly PropertyKey[]): string {
  return path.map((key) => `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('');
}
