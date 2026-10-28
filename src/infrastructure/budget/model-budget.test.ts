import { describe, expect, it } from 'vitest';
import { createModelBudget } from './model-budget';

const DAY = 24 * 60 * 60 * 1000;

function budget({ answersPerWindow = 100, dailyTokens = 1000 } = {}) {
  let clock = 0;
  let exhaustions = 0;
  return {
    ...createModelBudget({
      answersPerWindow,
      windowMs: 60_000,
      dailyTokens,
      now: () => clock,
      onExhausted: () => {
        exhaustions += 1;
      },
    }),
    exhaustions: () => exhaustions,
    at: (ms: number) => {
      clock = ms;
    },
  };
}

describe('model budget', () => {
  it('stops admitting model answers once the day’s tokens are spent', () => {
    const daily = budget({ dailyTokens: 1000 });
    expect(daily.admit('a')).toBe(true);
    daily.record({ inputTokens: 900, outputTokens: 100 });
    expect(daily.admit('a')).toBe(false);
    expect(daily.admit('someone-else')).toBe(false);
  });

  it('starts a fresh budget the next UTC day', () => {
    const daily = budget({ dailyTokens: 10 });
    daily.record({ inputTokens: 10, outputTokens: 0 });
    expect(daily.admit('a')).toBe(false);
    daily.at(DAY);
    expect(daily.admit('a')).toBe(true);
  });

  it('paces each client within the day’s budget', () => {
    const paced = budget({ answersPerWindow: 2 });
    expect(paced.admit('a')).toBe(true);
    expect(paced.admit('a')).toBe(true);
    expect(paced.admit('a')).toBe(false);
    expect(paced.admit('b')).toBe(true);
  });

  it('does not use up a visitor’s allowance on a day whose budget is already gone', () => {
    const both = budget({ answersPerWindow: 1, dailyTokens: 10 });
    both.record({ inputTokens: 10, outputTokens: 0 });
    expect(both.admit('a')).toBe(false);
    both.at(DAY);
    expect(both.admit('a')).toBe(true);
  });

  it('announces the day’s budget running out once, and again only on a later day', () => {
    const daily = budget({ dailyTokens: 100 });
    daily.record({ inputTokens: 60, outputTokens: 0 });
    expect(daily.exhaustions()).toBe(0);
    daily.record({ inputTokens: 30, outputTokens: 10 });
    daily.record({ inputTokens: 50, outputTokens: 0 });
    expect(daily.exhaustions()).toBe(1);
    daily.at(DAY);
    daily.record({ inputTokens: 100, outputTokens: 0 });
    expect(daily.exhaustions()).toBe(2);
  });
});

describe('model budget — bounded memory', () => {
  it('forgets idle clients', () => {
    const paced = budget();
    for (let client = 0; client < 10_000; client += 1) paced.admit(`client-${String(client)}`);
    paced.at(60_001);
    paced.admit('newcomer');
    expect(paced.trackedClients()).toBe(1);
  });
});
