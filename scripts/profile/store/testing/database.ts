import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import {
  REPOSITORY,
  runProfile,
  scratchDir,
  type CommandRun,
  type Scratch,
} from '../../testing/bundles';
import { withSession, type Session } from '../connect';
import { OWNER_ROLE, READER_ROLE } from '../initialise';
import { OWNER_URL, READER_URL } from '../urls';

/**
 * A throw-away profile database for the store tests: its own database in the
 * Postgres the tests were given, created through the real `pnpm profile init`
 * and dropped afterwards. Nothing here fakes the database — the tests that
 * claim something about the store prove it against this one.
 *
 * `PROFILE_TEST_ADMIN_URL` must point at a Postgres 17 reachable over TLS the
 * client can verify (`NODE_EXTRA_CA_CERTS`); the `store` project refuses to
 * run without it rather than skipping.
 */

export const ADMIN_URL_VARIABLE = 'PROFILE_TEST_ADMIN_URL';

export function testAdminUrl(): string {
  const url = process.env[ADMIN_URL_VARIABLE];
  if (!url) {
    throw new Error(
      `${ADMIN_URL_VARIABLE} is not set. The store tests run against a real Postgres: start one ` +
        'with `scripts/profile/store/testing/postgres.sh start` and export what it prints.',
    );
  }
  return url;
}

export type Role = 'admin' | 'owner' | 'reader';

export interface HeldLock {
  readonly release: () => Promise<void>;
}

/** What the store holds, as the "it changed nothing" assertions read it. */
export interface StoreCounts {
  readonly revisions: number;
  readonly documents: number;
  readonly blobs: number;
  readonly head: string | null;
  readonly digest: string | null;
}

export interface TestDatabase {
  readonly name: string;
  readonly host: string;
  readonly adminUrl: string;
  readonly ownerUrl: string;
  readonly readerUrl: string;
  /** What `pnpm profile init` printed when the harness created the store. */
  readonly initialised: CommandRun;
  /** `PROFILE_HOME` for the commands: bundles, backups and credentials land here. */
  readonly home: string;
  /** The environment a command is run with, with `extra` on top. */
  env: (extra?: Readonly<Record<string, string>>) => Record<string, string>;
  query: <Row>(role: Role, sql: string, values?: readonly unknown[]) => Promise<Row[]>;
  /**
   * Holds the row lock on `profile.head` until the caller releases it, so a
   * write blocks where it swaps the head in — after its backup, after its
   * rows, before it commits — which is the moment the import has to survive.
   */
  holdHead: () => Promise<HeldLock>;
  /** Starts `pnpm profile <args>` with the owner credential, without waiting for it. */
  startAsOwner: (
    args: readonly string[],
    extra?: Readonly<Record<string, string>>,
  ) => RunningCommand;
  /**
   * The same with the read-only credential, for a command the test has to let
   * run longer than `runProfile` waits.
   */
  startAsReader: (
    args: readonly string[],
    extra?: Readonly<Record<string, string>>,
  ) => RunningCommand;
  /** Waits until a session of that application is waiting for a lock. */
  waitForLockWait: (applicationName: string) => Promise<number>;
  terminate: (applicationName: string) => Promise<void>;
  counts: () => Promise<StoreCounts>;
  /** Runs `pnpm profile <args>` with the owner credential, as the owner would. */
  asOwner: (
    args: readonly string[],
    extra?: Readonly<Record<string, string>>,
  ) => Promise<CommandRun>;
  /** Runs `pnpm profile <args>` with the read-only credential, as a build does. */
  asReader: (
    args: readonly string[],
    extra?: Readonly<Record<string, string>>,
  ) => Promise<CommandRun>;
  drop: () => Promise<void>;
}

const CA = 'NODE_EXTRA_CA_CERTS';

function urlFor(base: string, database: string): string {
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.toString();
}

async function asAdmin<T>(url: string, work: (session: Session) => Promise<T>): Promise<T> {
  return withSession(
    { url, variable: ADMIN_URL_VARIABLE, applicationName: 'profile-test' },
    'The test harness',
    work,
  );
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const base = testAdminUrl();
  const name = `profile_test_${randomBytes(6).toString('hex')}`;
  const host = new URL(base).hostname;
  await asAdmin(base, async (open) => {
    await dropLeftovers(open, name);
    await open.query(`create database ${name}`);
  });
  const adminUrl = urlFor(base, name);
  const scratch = await scratchDir('profile-store-home-');
  const { ownerUrl, readerUrl, initialised } = await initialise(adminUrl, scratch, host, name);

  const urls: Record<Role, string> = { admin: adminUrl, owner: ownerUrl, reader: readerUrl };
  const query = async <Row>(role: Role, sql: string, values?: readonly unknown[]) =>
    withSession(
      { url: urls[role], variable: ADMIN_URL_VARIABLE, applicationName: 'profile-test' },
      `A ${role} query`,
      (open) => open.query(sql, values) as Promise<Row[]>,
    );

  const env = (extra: Readonly<Record<string, string>> = {}) => ({
    PROFILE_HOME: scratch.path,
    ...(process.env[CA] === undefined ? {} : { [CA]: process.env[CA] }),
    ...extra,
  });

  return {
    name,
    host,
    adminUrl,
    ownerUrl,
    readerUrl,
    initialised,
    home: scratch.path,
    env,
    query,
    counts: () => countsOf(query),
    startAsOwner: (args, extra = {}) =>
      startProfile(args, env({ PROFILE_OWNER_DATABASE_URL: ownerUrl, ...extra })),
    startAsReader: (args, extra = {}) =>
      startProfile(args, env({ PROFILE_DATABASE_URL: readerUrl, ...extra })),
    asOwner: (args, extra = {}) =>
      runProfile(args, env({ PROFILE_OWNER_DATABASE_URL: ownerUrl, ...extra })),
    asReader: (args, extra = {}) =>
      runProfile(args, env({ PROFILE_DATABASE_URL: readerUrl, ...extra })),
    holdHead: () => holdHead(adminUrl),
    waitForLockWait: (applicationName) => waitForLockWait(query, applicationName),
    terminate: async (applicationName) => {
      await query(
        'admin',
        'select pg_terminate_backend(pid) from pg_stat_activity where application_name = $1',
        [applicationName],
      );
    },
    drop: async () => {
      await asAdmin(base, (open) => dropDatabase(open, name));
      await scratch.remove();
    },
  };
}

async function initialise(adminUrl: string, scratch: Scratch, host: string, database: string) {
  const result = await runProfile(['init'], {
    PROFILE_HOME: scratch.path,
    PROFILE_ADMIN_DATABASE_URL: adminUrl,
    ...(process.env[CA] === undefined ? {} : { [CA]: process.env[CA] }),
  });
  expect(result, result.stderr).toMatchObject({ code: 0 });
  const credentials = await readFile(
    join(scratch.path, 'credentials', `${host}__${database}.env`),
    'utf8',
  );
  return {
    ownerUrl: credentialIn(credentials, OWNER_URL),
    readerUrl: credentialIn(credentials, READER_URL),
    initialised: result,
  };
}

async function countsOf(query: TestDatabase['query']): Promise<StoreCounts> {
  const [row] = await query<StoreCounts>(
    'admin',
    `select (select count(*)::int from profile.revision) as revisions,
            (select count(*)::int from profile.document) as documents,
            (select count(*)::int from profile.blob) as blobs,
            (select revision_id::text from profile.head) as head,
            (select encode(r.digest, 'hex') from profile.head h
               join profile.revision r on r.id = h.revision_id) as digest`,
  );
  if (!row) throw new Error('The database counted nothing.');
  return row;
}

function credentialIn(file: string, variable: string): string {
  const line = file.split('\n').find((text) => text.startsWith(`${variable}=`));
  if (!line) throw new Error(`\`pnpm profile init\` wrote no ${variable}.`);
  return line.slice(variable.length + 1);
}

/**
 * The two roles are cluster-wide, so each test file starts from a cluster with
 * neither of them and whatever a crashed run left behind. The store project
 * runs its files one at a time for the same reason.
 */
async function dropLeftovers(open: Session, keep: string): Promise<void> {
  const leftovers = await open.query<{ datname: string }>(
    `select datname from pg_database where datname like 'profile\\_test\\_%' and datname <> $1`,
    [keep],
  );
  for (const { datname } of leftovers) await dropDatabase(open, datname);
  for (const role of [OWNER_ROLE, READER_ROLE]) {
    const [exists] = await open.query('select 1 from pg_roles where rolname = $1', [role]);
    if (!exists) continue;
    await open.query('select pg_terminate_backend(pid) from pg_stat_activity where usename = $1', [
      role,
    ]);
    // Whatever a previous run left the role owning in this database, including
    // the grants on it; its own test database is already gone.
    await open.query(`drop owned by ${role} cascade`);
    await open.query(`drop role ${role}`);
  }
}

async function dropDatabase(open: Session, database: string): Promise<void> {
  await open.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1', [
    database,
  ]);
  await open.query(`drop database if exists ${database} with (force)`);
}

/**
 * `pnpm profile <args>` as a process the test can watch and kill: what it has
 * printed so far, and what it ends with.
 */
export interface RunningCommand {
  readonly output: () => string;
  readonly kill: (signal: NodeJS.Signals) => void;
  readonly finished: Promise<CommandRun>;
}

function startProfile(
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): RunningCommand {
  const child = spawn(
    join(REPOSITORY, 'node_modules', '.bin', 'tsx'),
    [join(REPOSITORY, 'scripts', 'profile.mts'), ...args],
    {
      cwd: REPOSITORY,
      env: { NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return {
    output: () => stdout + stderr,
    kill: (signal) => child.kill(signal),
    finished: new Promise((resolve) => {
      child.on('close', (code) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    }),
  };
}

async function holdHead(adminUrl: string): Promise<HeldLock> {
  let taken!: () => void;
  let release!: () => void;
  const isTaken = new Promise<void>((resolve) => {
    taken = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const holding = asAdmin(adminUrl, async (open) => {
    await open.query('begin');
    await open.query('update profile.head set updated_at = now()');
    taken();
    await released;
    await open.query('rollback');
  });
  await Promise.race([isTaken, holding]);
  return {
    release: async () => {
      release();
      await holding;
    },
  };
}

const LOCK_POLL_MS = 25;
const LOCK_WAIT_TIMEOUT_MS = 20_000;

/** Waits for a condition in the database, never for the clock. */
async function waitForLockWait(
  query: TestDatabase['query'],
  applicationName: string,
): Promise<number> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  for (;;) {
    const [waiting] = await query<{ pid: number }>(
      'admin',
      `select pid from pg_stat_activity
        where application_name = $1 and wait_event_type = 'Lock'`,
      [applicationName],
    );
    if (waiting) return waiting.pid;
    if (Date.now() > deadline) {
      throw new Error(`No ${applicationName} session ever waited for a lock.`);
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
}

/**
 * Neither the URL, nor the password in it, nor anything else secret may reach
 * the output of a command — a build log is public.
 */
/** The one row a query was written to return. */
export function one<Row>(rows: readonly Row[]): Row {
  const [row] = rows;
  if (row === undefined) throw new Error('The query returned no row.');
  return row;
}

export function expectNoCredential(output: string, ...urls: readonly string[]): void {
  for (const url of urls) {
    expect(output).not.toContain(url);
    const { password } = new URL(url);
    if (password) expect(output).not.toContain(password);
  }
}
