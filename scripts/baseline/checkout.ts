import { execFile, execFileSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const GIT_TIMEOUT_MS = 10_000;
/** Loading a profile and walking every question takes seconds; a minute means it hung. */
const IN_CHECKOUT_TIMEOUT_MS = 120_000;

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));

/** What runs inside the checkout being captured, and everything it imports from this folder. */
const IN_CHECKOUT_FILES = [
  'enumerate.mts',
  'retrieve.mts',
  'enumeration.ts',
  'retrieval.ts',
  'checkout-profile.ts',
  'inputs.ts',
  'private-files.ts',
];

/** Matches the scratch folders below, so the checkout's git never lists one as untracked. */
const SCRATCH_PATTERN = '/scripts/baseline-run-*/';
const INTERRUPTED_EXIT_CODE = 130;

/** The commit a checkout is at, and whether its files differ from that commit. */
export interface CheckoutState {
  readonly commit: string;
  readonly dirty: boolean;
}

export function checkoutState(checkout: string): CheckoutState {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', timeout: GIT_TIMEOUT_MS });
  return {
    commit: git('rev-parse', 'HEAD').trim(),
    dirty: git('status', '--porcelain').trim() !== '',
  };
}

/** The commit of the tool itself, so a baseline says which version of it was taken with. */
export function toolCommit(): string {
  return checkoutState(TOOL_DIR).commit;
}

/**
 * Runs one of this folder's in-checkout scripts with the checkout's own code
 * and dependencies. The files are copied to a scratch folder beside the
 * checkout's `scripts/`, so their imports of `../../src` reach that checkout.
 * While it runs, the folder is excluded from the checkout's git; afterwards —
 * or when the owner presses Ctrl-C — the folder and the exclusion are removed.
 */
export async function runInCheckout(
  checkout: string,
  script: 'enumerate.mts' | 'retrieve.mts',
  args: readonly string[],
): Promise<void> {
  const scratch = join(checkout, 'scripts', `baseline-run-${randomBytes(4).toString('hex')}`);
  const restoreExclusion = excludeScratch(checkout);
  let child: ChildProcess | undefined;
  const cleanUp = () => {
    rmSync(scratch, { recursive: true, force: true });
    restoreExclusion();
  };
  const onInterrupt = () => {
    child?.kill('SIGINT');
    cleanUp();
    process.exit(INTERRUPTED_EXIT_CODE);
  };
  process.once('SIGINT', onInterrupt);
  try {
    await mkdir(scratch);
    await Promise.all(
      IN_CHECKOUT_FILES.map((file) => copyFile(join(TOOL_DIR, file), join(scratch, file))),
    );
    const running = run('pnpm', ['exec', 'tsx', join(scratch, script), ...args], {
      cwd: checkout,
      timeout: IN_CHECKOUT_TIMEOUT_MS,
    });
    child = running.child;
    const { stdout } = await running;
    process.stdout.write(stdout);
  } finally {
    process.off('SIGINT', onInterrupt);
    cleanUp();
  }
}

/** Adds the scratch pattern to the checkout's `info/exclude`; the returned function takes it out. */
function excludeScratch(checkout: string): () => void {
  const gitPath = execFileSync('git', ['-C', checkout, 'rev-parse', '--git-path', 'info/exclude'], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
  }).trim();
  const file = resolve(checkout, gitPath);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (before?.split('\n').includes(SCRATCH_PATTERN)) return () => undefined;
  mkdirSync(dirname(file), { recursive: true });
  const separator = before && !before.endsWith('\n') ? '\n' : '';
  writeFileSync(file, `${before ?? ''}${separator}${SCRATCH_PATTERN}\n`);
  return () => {
    if (before === null) rmSync(file, { force: true });
    else writeFileSync(file, before);
  };
}
