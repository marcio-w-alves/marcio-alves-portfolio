import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderBrandCss } from '../../src/site/brand-css';
import { profileDataSchema } from '../../src/profile/schema';
import { digestOf } from './bundle/digest';
import { readBundleDirectory } from './bundle/read-directory';
import { stageDirectory, stagePublicFiles } from './materialize';
import {
  checkBundle,
  CLI_TEST_TIMEOUT_MS,
  EXAMPLE_DIR,
  exampleCopy,
  editDocument,
  runProfile,
  scratchDir,
  writeDocument,
  type Scratch,
} from './testing/bundles';

/**
 * `pnpm profile materialize`, run as the build runs it: it writes every file
 * the site imports from the selected profile's own bytes, refuses a
 * production build with no profile, writes nothing when a check fails, and
 * leaves the previous files whole.
 */

let scratch: Scratch;
let out: string;

beforeEach(async () => {
  scratch = await scratchDir();
  out = join(scratch.path, 'out');
});
afterEach(async () => {
  await scratch.remove();
});

const generated = (name: string) => join(out, 'src', 'profile', 'generated', name);
const readJson = async (path: string) =>
  JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Every file under a directory with the hash of its bytes, to show a tree did not change. */
async function snapshot(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(root, { recursive: true })) {
    const path = join(root, entry);
    if ((await stat(path)).isFile()) files[entry] = sha256(await readFile(path));
  }
  return files;
}

describe('materializing the example', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('writes every file the site imports, from the bundle’s own bytes', async () => {
    const { data } = await checkBundle(EXAMPLE_DIR);
    const bundle = (path: string) => readFile(join(EXAMPLE_DIR, path));

    const run = await runProfile(['materialize', '--out', out, '--example']);

    expect(run.code).toBe(0);
    expect(profileDataSchema.safeParse(await readJson(generated('profile.json'))).success).toBe(
      true,
    );
    expect(await readJson(generated('profile.json'))).toEqual(JSON.parse(JSON.stringify(data)));
    expect(await readFile(generated('knowledge-index.json'))).toEqual(
      await bundle('generated/knowledge-index.json'),
    );
    expect(await readFile(generated('retrieval-probes.json'))).toEqual(
      await bundle('generated/retrieval-probes.json'),
    );
    expect(await readFile(generated('brand.css'), 'utf8')).toBe(renderBrandCss(data.brand));
    expect(await readJson(generated('global-error.json'))).toEqual({ name: data.identity.name });
    expect(await readJson(generated('manifest.json'))).toMatchObject({
      source: 'example',
      revision: 'dir',
      digest: digestOf(await readBundleDirectory(EXAMPLE_DIR)),
      format: 1,
      locales: data.locales,
    });
    for (const { file, path } of data.assets) {
      expect(await readFile(join(out, 'public', path))).toEqual(await bundle(file));
    }
  });

  it('logs where the profile came from and how long it took, and none of what it says', async () => {
    const { data } = await checkBundle(EXAMPLE_DIR);

    const { stdout } = await runProfile(['materialize', '--out', out, '--example']);
    const digest = digestOf(await readBundleDirectory(EXAMPLE_DIR));

    expect(stdout).toMatch(
      new RegExp(
        `^Materialized the example profile: revision dir, digest ${digest.slice(0, 12)}, \\d+ documents, \\d+ ms\\.\\n$`,
      ),
    );
    for (const value of [
      data.identity.name,
      data.identity.contact.email,
      data.knowledge.profile.summary.en,
    ]) {
      expect(stdout).not.toContain(value);
    }
  });
});

describe('the profile a build is made from', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  // Until the site is built from a materialization, a build with no profile
  // source is a build from the TypeScript profile in src/profile — in
  // production too, which is where it is still serving from.
  it.each([{ VERCEL_ENV: 'production' }, {}])(
    'leaves the TypeScript profile alone when nothing is set (%j)',
    async (env) => {
      const run = await runProfile(['materialize', '--out', out], env);

      expect(run.code).toBe(0);
      expect(run.stdout).toContain('the site is built from the TypeScript profile in src/profile');
      await expect(stat(out)).rejects.toThrow();
    },
  );

  it('builds the example in production only when asked to', async () => {
    const run = await runProfile(['materialize', '--out', out], {
      VERCEL_ENV: 'production',
      PROFILE_SOURCE: 'example',
    });

    expect(run.code).toBe(0);
    expect(await readJson(generated('manifest.json'))).toMatchObject({ source: 'example' });
  });

  it('builds the example when asked to, with nothing else set', async () => {
    const run = await runProfile(['materialize', '--out', out, '--example']);

    expect(run.code).toBe(0);
    expect(await readJson(generated('manifest.json'))).toMatchObject({ source: 'example' });
  });

  it('builds a bundle named by PROFILE_BUNDLE_DIR, in production too', async () => {
    const dir = await exampleCopy(scratch);
    await editDocument(dir, 'identity.yaml', (identity: { name: string }) => {
      identity.name = 'Ada R. Rivera';
    });

    const run = await runProfile(['materialize', '--out', out], {
      VERCEL_ENV: 'production',
      PROFILE_BUNDLE_DIR: dir,
    });

    expect(run.code).toBe(0);
    expect(await readJson(generated('manifest.json'))).toMatchObject({ source: 'bundle' });
    expect(await readJson(generated('global-error.json'))).toEqual({ name: 'Ada R. Rivera' });
  });
});

describe('a materialization that fails', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('leaves the previous files exactly as they were', async () => {
    expect((await runProfile(['materialize', '--out', out, '--example'])).code).toBe(0);
    const before = await snapshot(out);
    const dir = await exampleCopy(scratch);
    await writeDocument(
      dir,
      'knowledge/knowledge-base.md',
      '## 1. Platform\n\nEdited, not regenerated.\n',
    );

    const run = await runProfile(['materialize', '--out', out], { PROFILE_BUNDLE_DIR: dir });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain(
      'generated/notes.json: is not knowledge/knowledge-base.md as it is now',
    );
    expect(await snapshot(out)).toEqual(before);
  });

  it('stops the build on a template that states a figure of the record (AC-22.1)', async () => {
    const dir = await exampleCopy(scratch);
    for (const locale of ['en', 'pt-BR']) {
      await editDocument(
        dir,
        `copy/${locale}/answers/answers.yaml`,
        (answers: { greeting?: { parts: unknown[] } }) => {
          const greeting = answers.greeting;
          if (greeting) greeting.parts = [{ text: '{{profile.name}} has been here since 2012.' }];
        },
      );
    }

    const run = await runProfile(['materialize', '--out', out], { PROFILE_BUNDLE_DIR: dir });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain(
      'copy/en/answers/answers.yaml#greeting.parts[0].text: writes the record\'s figure "2012" literally',
    );
    await expect(stat(out)).rejects.toThrow();
  });
});

describe('the public files of a profile', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('removes the ones the previous run wrote and the next profile lacks, and keeps the rest', async () => {
    const dir = await exampleCopy(scratch);
    expect((await runProfile(['materialize', '--out', out, '--example'])).code).toBe(0);
    await writeFile(join(out, 'public', 'hand-placed.txt'), 'mine');
    await editDocument(dir, 'assets.yaml', (assets: { path: string }[]) => {
      const photo = assets.find(({ path }) => path === '/ada-rivera.jpg');
      if (photo) photo.path = '/portrait.jpg';
    });
    await editDocument(
      dir,
      'knowledge/profile.yaml',
      (record: { profile: { photoUrl: string } }) => {
        record.profile.photoUrl = '/portrait.jpg';
      },
    );

    const run = await runProfile(['materialize', '--out', out], { PROFILE_BUNDLE_DIR: dir });

    expect(run.stderr).toBe('');
    expect(run.code).toBe(0);
    const files = await readdir(join(out, 'public'));
    expect(files).toContain('portrait.jpg');
    expect(files).toContain('hand-placed.txt');
    expect(files).not.toContain('ada-rivera.jpg');
  });
});

/** A server that accepts connections, never answers, and counts them. */
async function blackHole(): Promise<{
  url: string;
  connections: () => number;
  close: () => Promise<void>;
}> {
  let connections = 0;
  const server: Server = createServer((socket) => {
    connections += 1;
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No TCP address.');
  return {
    url: `postgres://reader:secret@127.0.0.1:${String(address.port)}/profile`,
    connections: () => connections,
    close: () =>
      new Promise((resolve) =>
        server.close(() => {
          resolve();
        }),
      ),
  };
}

describe('the materialization an install makes', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('never reaches a database, writes the example once, and leaves an existing one alone', async () => {
    const database = await blackHole();
    try {
      const env = { PROFILE_DATABASE_URL: database.url };

      const first = await runProfile(
        ['materialize', '--out', out, '--if-absent', '--example'],
        env,
      );
      expect(first.code).toBe(0);
      expect(await readJson(generated('manifest.json'))).toMatchObject({ source: 'example' });

      const manifest = await readFile(generated('manifest.json'));
      const second = await runProfile(
        ['materialize', '--out', out, '--if-absent', '--example'],
        env,
      );
      expect(second.code).toBe(0);
      expect(second.stdout).toContain('already materialized');
      expect(await readFile(generated('manifest.json'))).toEqual(manifest);

      expect(database.connections()).toBe(0);
    } finally {
      await database.close();
    }
  });

  it('writes the example where a directory exists but holds no materialization', async () => {
    await mkdir(join(out, 'src', 'profile', 'generated'), { recursive: true });

    const run = await runProfile(['materialize', '--out', out, '--if-absent', '--example']);

    expect(run.code).toBe(0);
    expect(await readJson(generated('manifest.json'))).toMatchObject({ source: 'example' });
  });
});

describe('the materialize command', { timeout: CLI_TEST_TIMEOUT_MS }, () => {
  it('needs the directory to write under, until the repository’s own files are generated', async () => {
    const run = await runProfile(['materialize', '--example']);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('materialize needs --out <dir>.');
  });

  // What a reachable database holds is proven against a real Postgres, in
  // `scripts/profile/store/*.store.test.ts`. Here: a database named but not
  // there is a failure, never a quiet fall back to the example.
  it('reports a database it cannot reach in one line, naming the host and no credential', async () => {
    const url = 'postgres://reader:secret@db.invalid/profile';

    const run = await runProfile(['materialize', '--out', out], { PROFILE_DATABASE_URL: url });

    expect(run.code).toBe(1);
    expect(run.stderr.trimEnd().split('\n')).toEqual([
      expect.stringContaining('Reading the profile failed against db.invalid after 1 attempt'),
    ]);
    expect(run.stdout + run.stderr).not.toContain('secret');
    expect(run.stdout).not.toContain('example');
    await expect(stat(out)).rejects.toThrow();
  });
});

describe('writing a materialization in one step', () => {
  const target = () => join(scratch.path, 'generated');

  async function stagedDirectory(files: Record<string, string>) {
    await mkdir(target(), { recursive: true });
    await writeFile(join(target(), 'manifest.json'), '{"source":"previous"}\n');
    return stageDirectory(target(), files);
  }

  const stagingDirs = async () =>
    (await readdir(scratch.path)).filter((name) => name.startsWith('.materialize-'));

  it('leaves the previous files untouched while the new ones are being written', async () => {
    const staged = await stagedDirectory({ 'manifest.json': '{"source":"next"}\n' });

    expect(await readFile(join(target(), 'manifest.json'), 'utf8')).toBe('{"source":"previous"}\n');
    await staged.swapIn();
    expect(await readFile(join(target(), 'manifest.json'), 'utf8')).toBe('{"source":"next"}\n');
    expect(await stagingDirs()).toEqual([]);
  });

  it('writes nothing and leaves no staging directory when a write fails midway', async () => {
    await mkdir(target(), { recursive: true });
    await writeFile(join(target(), 'manifest.json'), '{"source":"previous"}\n');
    const before = await snapshot(target());

    await expect(
      stageDirectory(target(), {
        'manifest.json': '{"source":"next"}\n',
        // No directory of that name is ever created, so this write throws —
        // after the first file of the same materialization was written.
        'missing/profile.json': '{}',
      }),
    ).rejects.toThrow();

    expect(await snapshot(target())).toEqual(before);
    expect(await stagingDirs()).toEqual([]);
  });

  it('puts an asset in place only when it is asked to, and removes what it replaces then', async () => {
    const dir = join(scratch.path, 'public');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'old.pdf'), 'previous');
    await writeFile(join(dir, '.materialized.json'), '["/old.pdf"]\n');

    const staged = await stagePublicFiles(
      dir,
      new Map([['/new.pdf', new TextEncoder().encode('next')]]),
    );

    expect(await readFile(join(dir, 'old.pdf'), 'utf8')).toBe('previous');
    expect(await readdir(dir)).not.toContain('new.pdf');
    await staged.swapIn();
    expect(await readdir(dir)).not.toContain('old.pdf');
    expect(await readFile(join(dir, 'new.pdf'), 'utf8')).toBe('next');
    expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });
});
