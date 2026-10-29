import { execFile, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
 * checkout's `scripts/`, so their imports of `../../src` reach that checkout,
 * and removed afterwards.
 */
export async function runInCheckout(
  checkout: string,
  script: 'enumerate.mts' | 'retrieve.mts',
  args: readonly string[],
): Promise<void> {
  const scratch = join(checkout, 'scripts', `baseline-run-${randomBytes(4).toString('hex')}`);
  await mkdir(scratch);
  try {
    await Promise.all(
      IN_CHECKOUT_FILES.map((file) => copyFile(join(TOOL_DIR, file), join(scratch, file))),
    );
    const { stdout } = await run('pnpm', ['exec', 'tsx', join(scratch, script), ...args], {
      cwd: checkout,
      timeout: IN_CHECKOUT_TIMEOUT_MS,
    });
    process.stdout.write(stdout);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
