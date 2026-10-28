import { describe, expect, it } from 'vitest';
import { cacheSuccesses } from './ttl-cache';

function counting<Value>(results: (Value | null)[]) {
  let calls = 0;
  return {
    load: () => Promise.resolve(results[calls++] ?? null),
    calls: () => calls,
  };
}

describe('cacheSuccesses', () => {
  it('serves a successful lookup from memory until it expires', async () => {
    let clock = 0;
    const source = counting(['first', 'second']);
    const cached = cacheSuccesses(1000, source.load, () => clock);

    expect(await cached('key')).toBe('first');
    clock = 999;
    expect(await cached('key')).toBe('first');
    expect(source.calls()).toBe(1);

    clock = 1000;
    expect(await cached('key')).toBe('second');
    expect(source.calls()).toBe(2);
  });

  it('asks again after a failure instead of remembering it', async () => {
    const source = counting([null, 'recovered']);
    const cached = cacheSuccesses(60_000, source.load);
    expect(await cached('key')).toBeNull();
    expect(await cached('key')).toBe('recovered');
  });

  it('keeps separate keys separate', async () => {
    const cached = cacheSuccesses(60_000, (key) => Promise.resolve(key.toUpperCase()));
    expect(await cached('react')).toBe('REACT');
    expect(await cached('redux')).toBe('REDUX');
  });
});
