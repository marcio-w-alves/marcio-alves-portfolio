import { describe, expect, it, vi } from 'vitest';
import { attempts, backoffMs, BACKOFF, isRetryable, MAX_ATTEMPTS, systemClock } from './retry';

/**
 * The retry policy, on its own: what it tries again, what it refuses to try
 * again, and the time it may spend doing so. A build waits for this, so the
 * total has to stay far inside the minute a deployment is given to find out
 * that the database is gone.
 */

function failure(code: string): Error {
  return Object.assign(new Error(`failed with ${code}`), { code });
}

const worthRetrying = [
  { why: 'the connection was refused', error: failure('ECONNREFUSED') },
  { why: 'the connection timed out', error: failure('ETIMEDOUT') },
  { why: 'the connection was reset', error: failure('ECONNRESET') },
  { why: 'the server is shutting down', error: failure('57P01') },
  { why: 'the server cannot accept connections yet', error: failure('57P03') },
  { why: 'the connection failed (SQLSTATE class 08)', error: failure('08006') },
  { why: 'the connection could not be established', error: failure('08001') },
  { why: 'the driver gave up waiting for the connection', error: new Error('timeout expired') },
];

const notWorthRetrying = [
  { why: 'the host does not resolve', error: failure('ENOTFOUND') },
  { why: 'the password is wrong', error: failure('28P01') },
  { why: 'the role may not do that', error: failure('42501') },
  { why: 'the row is already there', error: failure('23505') },
  { why: 'the transaction is read-only', error: failure('25006') },
  { why: 'the profile has a problem', error: new Error('the profile has 2 problems') },
];

describe('what is worth another attempt', () => {
  it.each(worthRetrying)('tries again when $why', ({ error }) => {
    expect(isRetryable(error)).toBe(true);
  });

  it.each(notWorthRetrying)('does not try again when $why', ({ error }) => {
    expect(isRetryable(error)).toBe(false);
  });

  it('looks through the failure it is reported as', () => {
    expect(isRetryable(new Error('Reading the profile failed', { cause: failure('57P01') }))).toBe(
      true,
    );
    expect(isRetryable(new Error('Reading the profile failed', { cause: failure('28P01') }))).toBe(
      false,
    );
  });
});

describe('the attempts', () => {
  const clock = (random = 1) => ({ sleep: vi.fn(async () => undefined), random: () => random });

  it('returns the first answer it gets', async () => {
    const work = vi.fn(async () => 'the profile');
    const waiting = clock();

    expect(await attempts(waiting, work)).toBe('the profile');
    expect(work).toHaveBeenCalledTimes(1);
    expect(waiting.sleep).not.toHaveBeenCalled();
  });

  it('tries again after a wait, and succeeds', async () => {
    const waiting = clock();
    let calls = 0;
    const work = async () => {
      calls += 1;
      if (calls < 3) throw failure('ECONNREFUSED');
      return 'the profile';
    };

    expect(await attempts(waiting, work)).toBe('the profile');
    expect(calls).toBe(3);
    expect(waiting.sleep.mock.calls).toEqual([[BACKOFF.baseMs], [BACKOFF.baseMs * 2]]);
  });

  it('gives up after three attempts, and reports the last failure', async () => {
    const waiting = clock();
    const work = vi.fn(async () => {
      throw failure('57P01');
    });

    await expect(attempts(waiting, work)).rejects.toThrow('57P01');
    expect(work).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(waiting.sleep).toHaveBeenCalledTimes(MAX_ATTEMPTS - 1);
  });

  it('makes one attempt at what another attempt cannot fix', async () => {
    const waiting = clock();
    const work = vi.fn(async () => {
      throw failure('28P01');
    });

    await expect(attempts(waiting, work)).rejects.toThrow('28P01');
    expect(work).toHaveBeenCalledTimes(1);
    expect(waiting.sleep).not.toHaveBeenCalled();
  });
});

describe('the wait between attempts', () => {
  it('grows to a cap, and anything from nothing to that is possible', () => {
    expect(backoffMs(1, 1)).toBe(BACKOFF.baseMs);
    expect(backoffMs(2, 1)).toBe(BACKOFF.baseMs * 2);
    expect(backoffMs(4, 1)).toBe(BACKOFF.baseMs * 8);
    expect(backoffMs(10, 1)).toBe(BACKOFF.capMs);
    expect(backoffMs(3, 0)).toBe(0);
    expect(backoffMs(3, 0.5)).toBe(BACKOFF.baseMs * 2);
  });

  it('spends at most seven seconds waiting across a whole read', () => {
    const longest = Array.from({ length: MAX_ATTEMPTS - 1 }, (_, index) =>
      backoffMs(index + 1, 1),
    ).reduce((total, wait) => total + wait, 0);

    expect(longest).toBeLessThanOrEqual(7_000);
  });

  it('waits on the clock it is given, and on the real one by default', async () => {
    vi.useFakeTimers();
    const slept = systemClock.sleep(50);
    vi.advanceTimersByTime(50);
    await slept;
    vi.useRealTimers();

    expect(systemClock.random()).toBeGreaterThanOrEqual(0);
    expect(systemClock.random()).toBeLessThan(1);
  });
});
