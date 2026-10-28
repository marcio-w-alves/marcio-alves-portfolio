import { describe, expect, it } from 'vitest';
import { createModelBudget } from './model-budget';

const DAY = 24 * 60 * 60 * 1000;

function budget({ answersPerWindow = 100, dailyTokens = 1000 } = {}) {
  let clock = 0;
  return {
    ...createModelBudget({ answersPerWindow, windowMs: 60_000, dailyTokens, now: () => clock }),
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
});
