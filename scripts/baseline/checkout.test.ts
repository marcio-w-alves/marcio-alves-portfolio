import { execFileSync, spawn } from 'node:child_process';
import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInCheckout } from './checkout';
import { REPOSITORY, scratchDir, TOOL_TEST_TIMEOUT_MS } from './testing/tool';

/**
 * A stand-in checkout — a real git repository — whose `tsx` is a shell script
 * that records what the checkout's git sees while the tool's files are
 * there, and can be held running until the test releases it.
 */

let scratch: Awaited<ReturnType<typeof scratchDir>>;
let checkout: string;
let log: string;

const STAND_IN_TSX = `#!/bin/sh
git status --porcelain --untracked-files=all > "$STAND_IN_LOG"
touch "$STAND_IN_LOG.started"
if [ -n "$STAND_IN_HOLD" ]; then
  while [ ! -f "$STAND_IN_LOG.release" ]; do sleep 0.1; done
fi
`;

const EXCLUDE_BEFORE = '# the owner’s own exclusions\n*.local\n';

beforeEach(async () => {
  scratch = await scratchDir();
  checkout = join(scratch.path, 'checkout');
  log = join(scratch.path, 'git-status.txt');
  await mkdir(join(checkout, 'scripts'), { recursive: true });
  await mkdir(join(checkout, 'node_modules', '.bin'), { recursive: true });
  execFileSync('git', ['init', '--quiet', checkout]);
  await writeFile(join(checkout, '.git', 'info', 'exclude'), EXCLUDE_BEFORE);
  await writeFile(
    join(checkout, 'package.json'),
    JSON.stringify({ name: 'stand-in', private: true }),
  );
  await writeFile(join(checkout, 'node_modules', '.bin', 'tsx'), STAND_IN_TSX);
  await chmod(join(checkout, 'node_modules', '.bin', 'tsx'), 0o755);
  // node_modules is the checkout's own business; only the tool's folder is under test.
  await writeFile(join(checkout, '.gitignore'), 'node_modules/\n.gitignore\npackage.json\n');
  vi.stubEnv('STAND_IN_LOG', log);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await scratch.remove();
});

const scriptsLeft = () => readdir(join(checkout, 'scripts'));
const exclusions = () => readFile(join(checkout, '.git', 'info', 'exclude'), 'utf8');

describe('running inside the checkout being captured', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it("keeps the tool's folder out of the checkout's git while it runs, then removes both", async () => {
    await runInCheckout(checkout, 'enumerate.mts', []);

    expect(await readFile(log, 'utf8')).toBe('');
    expect(await scriptsLeft()).toEqual([]);
    expect(await exclusions()).toBe(EXCLUDE_BEFORE);
  });

  it('removes its folder and the exclusion when interrupted with Ctrl-C', async () => {
    const driver = spawn(
      join(REPOSITORY, 'node_modules', '.bin', 'tsx'),
      [join(REPOSITORY, 'scripts', 'baseline', 'testing', 'run-in-checkout.mts'), checkout],
      { env: { ...process.env, STAND_IN_LOG: log, STAND_IN_HOLD: '1' } },
    );
    const exited = new Promise<number | null>((resolve) => driver.on('exit', resolve));
    await vi.waitFor(() => readFile(`${log}.started`), { timeout: 20_000, interval: 50 });
    expect(await scriptsLeft()).toHaveLength(1);

    driver.kill('SIGINT');
    const code = await exited;
    await writeFile(`${log}.release`, '');

    expect(code).toBe(130);
    expect(await scriptsLeft()).toEqual([]);
    expect(await exclusions()).toBe(EXCLUDE_BEFORE);
  });
});
