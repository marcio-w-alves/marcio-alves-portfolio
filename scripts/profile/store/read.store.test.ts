import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXAMPLE_DIR, runProfile, scratchDir, type Scratch } from '../testing/bundles';
import { withSession, TIMEOUTS } from './connect';
import { MAX_ATTEMPTS } from './retry';
import {
  corruptHead,
  createTestDatabase,
  expectNoCredential,
  type TestDatabase,
} from './testing/database';
import { blackHole, withoutTls } from './testing/servers';
import { READER_URL } from './urls';

/**
 * What a build gets out of the database, and what it does when it cannot have
 * it. The one answer it may never give is the example profile: a production
 * build that cannot read the profile fails, and the deployment that is live
 * stays live.
 */

let db: TestDatabase;
let scratch: Scratch;

beforeAll(async () => {
  db = await createTestDatabase();
  scratch = await scratchDir('profile-read-');
}, 120_000);

afterAll(async () => {
  await scratch.remove();
  await db.drop();
});

function out(name: string): string {
  return join(scratch.path, name);
}

async function materialized(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => []);
}

describe('reading a profile that is not there', () => {
  it('says what to do when the database holds no profile yet', async () => {
    const target = out('empty-store');

    const run = await db.asReader(['materialize', '--out', target]);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('holds no profile yet');
    expect(await materialized(target)).toEqual([]);
  });
});

describe('reading the stored profile', () => {
  beforeAll(async () => {
    const imported = await db.asOwner(['import', EXAMPLE_DIR]);
    expect(imported, imported.stderr).toMatchObject({ code: 0 });
  }, 60_000);

  it('materializes what the head revision holds', async () => {
    const target = out('from-database');

    const run = await db.asReader(['materialize', '--out', target]);

    expect(run, run.stderr).toMatchObject({ code: 0 });
    const { head, digest } = await db.counts();
    expect(run.stdout).toContain(`revision ${String(head)}`);
    const manifest = await manifestIn(target);
    expect(manifest).toMatchObject({ source: 'database', revision: head, digest });
  });

  it('refuses a stored profile whose bytes no longer hash to their key', async () => {
    const target = out('corrupt');
    const corrupted = await corruptHead(db);

    const run = await db.asReader(['materialize', '--out', target]);
    await corrupted.repair();

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('corrupt');
    expect(run.stderr).toContain('privacy.yaml');
    expect(run.stderr).toContain('pnpm profile restore');
    expect(await materialized(target)).toEqual([]);
    // And the profile reads again, so what runs after this tests itself.
    const after = await db.asReader(['materialize', '--out', out('after-repair')]);
    expect(after, after.stderr).toMatchObject({ code: 0 });
  });

  it('reads over verified TLS whatever the URL asks for', async () => {
    const asking = new URL(db.readerUrl);
    asking.searchParams.set('sslmode', 'disable');
    const withoutTheCa = { ...db.env({ PROFILE_DATABASE_URL: asking.toString() }) };
    delete withoutTheCa.NODE_EXTRA_CA_CERTS;

    const run = await runProfile(
      ['materialize', '--out', out('sslmode-disable')],
      db.env({ PROFILE_DATABASE_URL: asking.toString() }),
    );
    const unverified = await runProfile(
      ['materialize', '--out', out('sslmode-no-ca')],
      withoutTheCa,
    );

    // TLS is this module's decision, not the URL's: the read succeeds, and it
    // was TLS, because trusting the CA is the only thing that let it.
    expect(run, run.stderr).toMatchObject({ code: 0 });
    expect(unverified.code).toBe(1);
    expect(unverified.stderr).toContain('unable to verify');
  });

  it('carries its timeouts and its name into every session', async () => {
    const settings = await withSession(
      { url: db.readerUrl, variable: READER_URL, applicationName: 'profile-import' },
      'Reading the session settings',
      (open) =>
        open.query<{ name: string; setting: string }>(
          `select name, setting from pg_settings
            where name in ('statement_timeout', 'lock_timeout',
                           'idle_in_transaction_session_timeout', 'application_name')`,
        ),
    );

    expect(Object.fromEntries(settings.map(({ name, setting }) => [name, setting]))).toEqual({
      application_name: 'profile-import',
      statement_timeout: String(TIMEOUTS.statementMs),
      lock_timeout: String(TIMEOUTS.lockMs),
      idle_in_transaction_session_timeout: String(TIMEOUTS.idleInTransactionMs),
    });
  });
});

describe('a database the build cannot reach', () => {
  it('never falls back to the example, and gives up well inside a minute', async () => {
    const server = await blackHole();
    const target = out('black-hole');

    const started = Date.now();
    // Started rather than run: the point of the test is how long it takes to
    // give up, so nothing else may cut it short.
    const run = await db.startAsReader(['materialize', '--out', target], {
      PROFILE_DATABASE_URL: server.url(),
      VERCEL_ENV: 'production',
    }).finished;
    const elapsed = Date.now() - started;

    await server.close();
    expect(run.code).not.toBe(0);
    expect(elapsed).toBeLessThan(60_000);
    // It really tried: three attempts, each of them timing out.
    expect(elapsed).toBeGreaterThanOrEqual(TIMEOUTS.connectMs * MAX_ATTEMPTS);
    expect(server.connections()).toBe(MAX_ATTEMPTS);
    expect(run.stderr).toContain('localhost');
    expect(run.stderr).toContain('timed out');
    expect(run.stderr).toContain(`${String(MAX_ATTEMPTS)} attempts`);
    expect(run.stdout).not.toContain('example');
    expect(await materialized(target)).toEqual([]);
    expectNoCredential(run.stdout + run.stderr, server.url());
  }, 90_000);

  it('does not try again when the host does not exist or the password is wrong', async () => {
    const unknownHost = 'postgres://profile_reader:secret@not-a-host.invalid/profile';
    const wrongPassword = new URL(db.readerUrl);
    wrongPassword.password = 'not-the-password';

    const missing = await runProfile(
      ['materialize', '--out', out('unknown-host')],
      // Outside a production deployment, where the example is what a build
      // would otherwise take: a database that was named and cannot be read is
      // still a failure, not a fall back.
      db.env({ PROFILE_SOURCE: 'database', PROFILE_DATABASE_URL: unknownHost }),
    );
    const refused = await runProfile(
      ['materialize', '--out', out('wrong-password')],
      db.env({ PROFILE_DATABASE_URL: wrongPassword.toString() }),
    );

    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('1 attempt:');
    expect(missing.stdout).not.toContain('example');
    expect(await materialized(out('unknown-host'))).toEqual([]);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain('1 attempt:');
    expect(refused.stderr).toContain('28P01');
    expectNoCredential(missing.stdout + missing.stderr, unknownHost);
    expectNoCredential(refused.stdout + refused.stderr, wrongPassword.toString(), db.readerUrl);
  }, 60_000);
});

describe('the connection the tools insist on', () => {
  it('refuses a server that does not offer TLS', async () => {
    const server = await withoutTls();

    const run = await runProfile(
      ['materialize', '--out', out('no-tls')],
      db.env({ PROFILE_DATABASE_URL: server.url() }),
    );

    await server.close();
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('does not support SSL');
    expect(await materialized(out('no-tls'))).toEqual([]);
    expectNoCredential(run.stdout + run.stderr, server.url());
  });

  it('refuses a certificate it cannot verify', async () => {
    const withoutTheCa = { ...db.env({ PROFILE_DATABASE_URL: db.readerUrl }) };
    delete withoutTheCa.NODE_EXTRA_CA_CERTS;

    const run = await runProfile(['materialize', '--out', out('untrusted')], withoutTheCa);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain('unable to verify');
    expect(run.stderr).toContain(db.host);
    expect(await materialized(out('untrusted'))).toEqual([]);
    expectNoCredential(run.stdout + run.stderr, db.readerUrl);
  });
});

async function manifestIn(dir: string): Promise<unknown> {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(
    await readFile(join(dir, 'src/profile/generated/manifest.json'), 'utf8'),
  ) as unknown;
}
