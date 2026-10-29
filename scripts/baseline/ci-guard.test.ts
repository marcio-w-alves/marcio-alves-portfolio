import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTool, scratchDir, TOOL_TEST_TIMEOUT_MS } from './testing/tool';

/** CI logs and artifacts are public, so the commands refuse the owner's profile there outright. */

let scratch: Awaited<ReturnType<typeof scratchDir>>;

beforeEach(async () => {
  scratch = await scratchDir();
});
afterEach(async () => {
  await scratch.remove();
});

const REFUSAL = 'Refusing the "owner" profile in CI';
// Nothing listens here: a command that got as far as the network would fail differently.
const NOWHERE = 'http://127.0.0.1:9/';

describe('the owner profile in CI', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it.each([
    ['CI', { CI: 'true' }],
    ['GITHUB_ACTIONS', { GITHUB_ACTIONS: 'true' }],
  ])('is refused by the capture before any work when %s is set', async (_name, env) => {
    const out = join(scratch.path, 'baseline');

    const refused = await runTool('capture.mts', ['--target', NOWHERE, '--out', out], env);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(REFUSAL);
    await expect(access(out)).rejects.toThrow();
  });

  it('is refused by the comparison before any work', async () => {
    const refused = await runTool(
      'compare.mts',
      ['--baseline', join(scratch.path, 'none'), '--target', NOWHERE],
      { CI: 'true' },
    );

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(REFUSAL);
  });
});
