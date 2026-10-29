import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLI_TEST_TIMEOUT_MS,
  EXAMPLE_DIR,
  exampleCopy,
  runProfile,
  scratchDir,
  writeDocument,
  type Scratch,
} from './testing/bundles';

/**
 * `pnpm profile check`, run as the owner runs it: it says a sound bundle is
 * sound, lists every problem of one that is not and exits non-zero, and never
 * writes anything either way.
 */

let scratch: Scratch;

beforeEach(async () => {
  scratch = await scratchDir();
});
afterEach(async () => {
  await scratch.remove();
});

describe('the check command', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('reports the shipped example as sound, with its size and digest', async () => {
    const run = await runProfile(['check', EXAMPLE_DIR]);

    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(
      new RegExp(
        `^The profile in ${EXAMPLE_DIR} passes every check \\(\\d+ documents, digest [0-9a-f]{12}\\)\\.\\n$`,
      ),
    );
    expect(run.stderr).toBe('');
  });

  it('lists every problem of a bundle that is not sound, and exits 1', async () => {
    const dir = await exampleCopy(scratch);
    await writeDocument(dir, 'privacy.yaml', 'phrases:\r\n  - a phrase\r\n');
    await writeDocument(dir, 'knowledge/notes-guide.md', '\uFEFFTags the model reads.\n');

    const run = await runProfile(['check', dir]);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('The profile has 2 problems:');
    expect(run.stderr).toContain(
      'privacy.yaml: has carriage returns (CRLF) — save with LF line endings',
    );
    expect(run.stderr).toContain(
      'knowledge/notes-guide.md: starts with a byte order mark — save it as UTF-8 without a BOM',
    );
  });

  it('needs the bundle to check', async () => {
    const run = await runProfile(['check']);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('check needs the bundle directory.');
  });
});
