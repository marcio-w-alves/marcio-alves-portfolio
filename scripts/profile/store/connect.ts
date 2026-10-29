import { Client, type ClientConfig, type QueryResultRow } from 'pg';
import { ReportedError } from '../reported-error';
import { attempts, isConnectTimeout, type Clock } from './retry';

/**
 * How the tools talk to the profile database: over TLS the client verifies,
 * with a timeout on everything, and with the connection URL parsed once and
 * never put into a message — an error names the host, the operation and the
 * SQLSTATE, so a failing build or a public log never carries a credential.
 */

export const TIMEOUTS = {
  /** Long enough for a compute that suspended while idle to wake up. */
  connectMs: 10_000,
  statementMs: 15_000,
  /** The client's own bound, over the server's statement timeout. */
  queryMs: 20_000,
  lockMs: 5_000,
  idleInTransactionMs: 30_000,
} as const;

/** A URL that is not a Postgres URL at all: a setting to fix, not a failure to retry. */
export class DatabaseUrlError extends ReportedError {
  constructor(variable: string, problem: string) {
    super(`${variable} is not a Postgres connection URL: ${problem}.`);
  }
}

/** A database call that failed, said without the URL it was made with. */
export class StoreError extends ReportedError {
  constructor(
    readonly operation: string,
    readonly host: string,
    readonly tries: number,
    cause: unknown,
  ) {
    super(
      `${operation} failed against ${host} after ${String(tries)} ` +
        `attempt${tries === 1 ? '' : 's'}: ${describe(cause)}`,
      { cause },
    );
  }
}

export function sqlStateOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** What went wrong, in the words of the driver, with its SQLSTATE and nothing else. */
function describe(cause: unknown): string {
  if (!(cause instanceof Error)) return 'unknown cause';
  const code = sqlStateOf(cause);
  const detail = code === undefined ? '' : ` (${code})`;
  return `${isConnectTimeout(cause) ? 'the connection timed out' : cause.message}${detail}`;
}

interface Target {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * The parts of a connection URL. Only these reach the driver: TLS and the
 * timeouts are this module's to decide, so no query parameter of the URL can
 * turn verification off.
 */
export function targetOf(url: string, variable: string): Target {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DatabaseUrlError(variable, 'it cannot be read as a URL');
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    throw new DatabaseUrlError(variable, 'it does not start with postgres://');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!parsed.hostname) throw new DatabaseUrlError(variable, 'it names no host');
  if (!database) throw new DatabaseUrlError(variable, 'it names no database');
  if (!parsed.username) throw new DatabaseUrlError(variable, 'it names no user');
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

export interface SessionOptions {
  readonly url: string;
  /** The environment variable the URL came from, named when it cannot be read. */
  readonly variable: string;
  /** Shown in `pg_stat_activity`, so a session can be recognised in monitoring. */
  readonly applicationName: string;
}

function configOf({ host, port, database, user, password }: Target, applicationName: string) {
  return {
    host,
    port,
    database,
    user,
    password,
    // Verified TLS, always: the server's certificate must be trusted and must
    // be the certificate of the host we asked for.
    ssl: { rejectUnauthorized: true, servername: host },
    enableChannelBinding: true,
    application_name: applicationName,
    connectionTimeoutMillis: TIMEOUTS.connectMs,
    statement_timeout: TIMEOUTS.statementMs,
    query_timeout: TIMEOUTS.queryMs,
    lock_timeout: TIMEOUTS.lockMs,
    idle_in_transaction_session_timeout: TIMEOUTS.idleInTransactionMs,
  } satisfies ClientConfig;
}

export interface Session {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<Row[]>;
  /** Runs `work` in a transaction, committing it or rolling it back. */
  transaction<T>(mode: TransactionMode, work: () => Promise<T>): Promise<T>;
}

export type TransactionMode = 'read committed' | 'repeatable read read only' | 'serializable';

/**
 * Opens one session, hands it to `work`, and closes it whatever happens.
 * Failures come back as a `StoreError` naming the host and the operation.
 */
export async function withSession<T>(
  { url, variable, applicationName }: SessionOptions,
  operation: string,
  work: (session: Session) => Promise<T>,
): Promise<T> {
  const target = targetOf(url, variable);
  const client = new Client(configOf(target, applicationName));
  // A connection the server drops — a restart, a terminated backend, a network
  // that went away — is reported twice by the driver: once by rejecting what
  // was in flight, and once as an 'error' event. Without a listener for the
  // second, Node ends the process on an unhandled event, which would turn a
  // clean report into a crash and skip the retries.
  client.on('error', () => undefined);
  try {
    await client.connect();
    return await work(sessionOf(client));
  } catch (error) {
    // A failure that already reads as a report — "the database holds no
    // profile yet" — says more than "the operation failed".
    if (error instanceof ReportedError) throw error;
    throw new StoreError(operation, target.host, 1, error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function sessionOf(client: Client): Session {
  const query = async <Row extends QueryResultRow>(sql: string, values?: readonly unknown[]) =>
    (await client.query<Row>(sql, values === undefined ? undefined : [...values])).rows;
  return {
    query,
    transaction: async (mode, work) => {
      await query(`begin isolation level ${mode}`);
      try {
        const result = await work();
        await query('commit');
        return result;
      } catch (error) {
        await query('rollback').catch(() => undefined);
        throw error;
      }
    },
  };
}

export interface RetryingSessionOptions extends SessionOptions {
  /** Injected in tests; the real clock otherwise. */
  readonly clock?: Clock;
}

/**
 * A read, attempted up to three times when what failed is worth another try.
 * The budget is the build's: a dead host must be reported well inside a
 * minute, not after a quarter of an hour of patience.
 */
export async function readWithRetries<T>(
  { clock, ...session }: RetryingSessionOptions,
  operation: string,
  work: (session: Session) => Promise<T>,
): Promise<T> {
  const host = targetOf(session.url, session.variable).host;
  let tries = 0;
  return attempts(clock, async () => {
    tries += 1;
    try {
      return await withSession(session, operation, work);
    } catch (error) {
      throw error instanceof StoreError
        ? new StoreError(operation, host, tries, error.cause)
        : error;
    }
  });
}
