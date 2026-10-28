import { describe, expect, it } from 'vitest';
import { createSlidingWindowLimiter } from './sliding-window';

function limiter(limit: number, windowMs: number) {
  let clock = 0;
  const window = createSlidingWindowLimiter({ limit, windowMs, now: () => clock });
  return {
    admit: (key: string) => window.admit(key),
    at: (ms: number) => {
      clock = ms;
    },
  };
}

describe('sliding window limiter', () => {
  it('admits up to the limit within the window, then refuses', () => {
    const { admit } = limiter(3, 1000);
    expect([admit('a'), admit('a'), admit('a')].every((result) => result.allowed)).toBe(true);
    expect(admit('a').allowed).toBe(false);
  });

  it('says how long until the oldest request leaves the window', () => {
    const { admit, at } = limiter(2, 1000);
    admit('a');
    at(300);
    admit('a');
    at(400);
    expect(admit('a')).toEqual({ allowed: false, retryAfterMs: 600 });
  });

  it('rolls rather than resets: capacity comes back one request at a time', () => {
    const { admit, at } = limiter(2, 1000);
    admit('a');
    at(500);
    admit('a');
    at(1000);
    expect(admit('a').allowed).toBe(true);
    expect(admit('a').allowed).toBe(false);
  });

  it('does not count refused requests against the client', () => {
    const { admit, at } = limiter(1, 1000);
    admit('a');
    at(100);
    admit('a');
    admit('a');
    at(1000);
    expect(admit('a').allowed).toBe(true);
  });

  it('keeps clients independent', () => {
    const { admit } = limiter(1, 1000);
    expect(admit('a').allowed).toBe(true);
    expect(admit('b').allowed).toBe(true);
    expect(admit('a').allowed).toBe(false);
  });
});
