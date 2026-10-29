/**
 * What is worth attempting again, and how long to wait before doing so.
 *
 * A read of the profile happens while a build waits, so the budget is the
 * build's: three attempts with a short jittered backoff, well inside the
 * minute a deployment may spend finding out that the database is gone. Only
 * failures another attempt could fix are retried — a wrong password or a
 * misspelled host is a setting to correct, and trying it again only makes the
 * report arrive later. Writes are never retried: an import is identified by
 * its digest, so the owner runs it again and an applied one reports no
 * changes.
 */

export const MAX_ATTEMPTS = 3;
export const BACKOFF = { baseMs: 1_000, capMs: 8_000 } as const;

/** Connections that dropped or never came up, and servers shutting down or recovering. */
const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
]);

/** Failures a setting has to fix: another attempt would fail the same way. */
const PERMANENT_CODES: ReadonlySet<string> = new Set([
  'ENOTFOUND', // the host does not resolve
  'ECONNABORTED',
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name
  '42501', // insufficient_privilege
  '23505', // unique_violation
  '25006', // read_only_sql_transaction
]);

/** SQLSTATE class 08: every connection exception. */
const CONNECTION_CLASS = '08';

export interface Clock {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

export const systemClock: Clock = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/** pg reports a connection that never answered with this message and no code. */
export function isConnectTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === 'timeout expired';
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function causes(error: unknown): unknown[] {
  const chain: unknown[] = [];
  for (let step = error; step instanceof Error; step = step.cause) chain.push(step);
  return chain;
}

function isRetryableOnItsOwn(error: unknown): boolean {
  const code = codeOf(error);
  if (code === undefined) return isConnectTimeout(error);
  if (PERMANENT_CODES.has(code)) return false;
  return RETRYABLE_CODES.has(code) || code.startsWith(CONNECTION_CLASS);
}

/** Whether the failure, or anything it was caused by, is worth another attempt. */
export function isRetryable(error: unknown): boolean {
  const chain = causes(error);
  if (chain.some((link) => PERMANENT_CODES.has(codeOf(link) ?? ''))) return false;
  return chain.some(isRetryableOnItsOwn);
}

/** Full jitter: anything from no wait to the capped exponential delay. */
export function backoffMs(attempt: number, random: number): number {
  return Math.round(random * Math.min(BACKOFF.capMs, BACKOFF.baseMs * 2 ** (attempt - 1)));
}

/**
 * Runs `work`, and runs it again — up to `MAX_ATTEMPTS` in all — while it
 * fails with something another attempt could fix.
 */
export async function attempts<T>(clock: Clock = systemClock, work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt === MAX_ATTEMPTS || !isRetryable(error)) throw error;
      await clock.sleep(backoffMs(attempt, clock.random()));
    }
  }
}
