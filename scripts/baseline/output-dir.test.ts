import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { profile as fixtureProfile } from '../../src/testing/fixture-profile/profile';
import { enumerateInputs } from './enumeration';
import { readManifest } from './manifest';
import { OUTSIDE_REPOSITORY_RULE } from './output-dir';
import { startSiteServer, type SiteServer } from './testing/site-server';
import { REPOSITORY, runTool, scratchDir, TOOL_TEST_TIMEOUT_MS, writeInputs } from './testing/tool';

/**
 * A baseline holds the owner's personal data: the capture command refuses to
 * write one inside any work tree of this repository, however the path gets
 * there, and writes under PROFILE_HOME/baseline/ by default.
 */

const flipCase = (path: string) =>
  path.replace(/\p{L}/gu, (letter) =>
    letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase(),
  );

/** macOS and Windows file systems answer to a path in any case; most Linux ones do not. */
const FILE_SYSTEM_IGNORES_CASE = existsSync(flipCase(REPOSITORY));

let scratch: Awaited<ReturnType<typeof scratchDir>>;
let site: SiteServer;
let inputsFile: string;

beforeEach(async () => {
  scratch = await scratchDir();
  site = await startSiteServer();
  const inputs = enumerateInputs(fixtureProfile, []);
  inputsFile = await writeInputs(scratch.path, {
    ...inputs,
    pages: [],
    routes: [],
    answers: inputs.answers.slice(0, 2),
  });
});
afterEach(async () => {
  await site.close();
  await scratch.remove();
});

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

function captureTo(out: string | null, env: Record<string, string> = {}) {
  return runTool(
    'capture.mts',
    [
      '--target',
      site.url.href,
      '--checkout',
      REPOSITORY,
      '--inputs',
      inputsFile,
      '--profile',
      'fixture',
      ...(out ? ['--out', out] : []),
    ],
    env,
  );
}

describe('where a baseline may be written', { timeout: TOOL_TEST_TIMEOUT_MS }, () => {
  it('refuses an output directory inside the work tree, naming the rule', async () => {
    const inside = join(REPOSITORY, 'scripts', 'baseline', 'captured-by-mistake');

    const refused = await captureTo(inside);

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(OUTSIDE_REPOSITORY_RULE);
    expect(await exists(inside)).toBe(false);
  });

  it('refuses an output directory that reaches the work tree through a symlink', async () => {
    const link = join(scratch.path, 'looks-outside');
    await symlink(join(REPOSITORY, 'scripts'), link);

    const refused = await captureTo(join(link, 'baseline-by-mistake'));

    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain(OUTSIDE_REPOSITORY_RULE);
    expect(await exists(join(REPOSITORY, 'scripts', 'baseline-by-mistake'))).toBe(false);
  });

  it.skipIf(!FILE_SYSTEM_IGNORES_CASE)(
    'refuses an output directory inside the work tree spelled in another case',
    async () => {
      const inside = join(REPOSITORY, 'scripts', 'baseline', 'captured-by-mistake');

      const refused = await captureTo(flipCase(inside));

      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain(OUTSIDE_REPOSITORY_RULE);
      expect(await exists(inside)).toBe(false);
    },
  );

  it('writes under PROFILE_HOME/baseline/<commit>/ when no directory is given', async () => {
    const home = join(scratch.path, 'profile-home');
    await mkdir(home);
    const head = execFileSync('git', ['-C', REPOSITORY, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();

    const accepted = await captureTo(null, { PROFILE_HOME: home });

    const baseline = join(home, 'baseline', head);
    expect(accepted.code).toBe(0);
    expect(accepted.stdout).toContain(`Baseline captured in ${baseline}`);
    await expect(readManifest(baseline)).resolves.toMatchObject({ commit: head });
  });
});
