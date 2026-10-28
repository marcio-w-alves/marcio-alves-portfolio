import { describe, expect, it } from 'vitest';
import { createSlidingWindowLimiter } from './sliding-window';

function limiter(limit: number, windowMs: number, maxKeys?: number) {
  let clock = 0;
  let evictions = 0;
  const window = createSlidingWindowLimiter({
    limit,
    windowMs,
    now: () => clock,
    ...(maxKeys ? { maxKeys } : {}),
    onEvicted: () => {
      evictions += 1;
    },
  });
  return {
    admit: (key: string) => window.admit(key),
    size: () => window.size(),
    evictions: () => evictions,
    at: (ms: number) => {
      clock = ms;
    },
  };
}

function admitMany(admit: (key: string) => unknown, count: number): void {
  for (let client = 0; client < count; client += 1) admit(`client-${String(client)}`);
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

describe('sliding window limiter — bounded memory', () => {
  it('forgets clients whose window has passed', () => {
    const { admit, size, at } = limiter(1, 1000);
    admitMany(admit, 10_000);
    at(1001);
    admit('newcomer');
    expect(size()).toBe(1);
  });

  it('sweeps exactly at the window edge, not before', () => {
    const { admit, size, at } = limiter(1, 1000);
    admitMany(admit, 10_000);
    at(999);
    admit('newcomer');
    expect(size()).toBe(10_001);
    at(1000);
    admit('latecomer');
    expect(size()).toBe(2);
  });

  it('keeps an active client’s count through a sweep', () => {
    const { admit, at } = limiter(2, 1000);
    at(500);
    admit('a');
    at(600);
    admit('a');
    at(1000);
    admit('b');
    expect(admit('a')).toEqual({ allowed: false, retryAfterMs: 500 });
  });

  it('caps the clients it tracks under a flood within one window', () => {
    const { admit, size } = limiter(1, 1000, 3);
    admitMany(admit, 4);
    expect(size()).toBe(3);
    expect(admit('client-0').allowed).toBe(true);
    expect(admit('client-3').allowed).toBe(false);
  });

  it('forgets the client admitted least recently first', () => {
    const { admit } = limiter(2, 1000, 3);
    admitMany(admit, 3);
    admit('client-0');
    admit('newcomer');
    expect(admit('client-0').allowed).toBe(false);
    expect(admit('client-1').allowed).toBe(true);
  });

  it('reports forced evictions once per window, not once per client', () => {
    const { admit, evictions, at } = limiter(1, 1000, 3);
    admitMany(admit, 6);
    expect(evictions()).toBe(1);
    at(1000);
    admitMany(admit, 6);
    expect(evictions()).toBe(2);
  });
});
