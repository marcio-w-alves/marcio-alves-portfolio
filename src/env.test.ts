import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantSettings } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assistant settings', () => {
  it('uses the defaults when a deployment sets nothing', () => {
    expect(assistantSettings()).toEqual({
      openAITimeoutMs: 20_000,
      requestsPerTenMinutes: 40,
      modelAnswersPerTenMinutes: 15,
      dailyModelTokens: 2_000_000,
    });
  });

  it('takes what the deployment sets, numbers included', () => {
    vi.stubEnv('OPENAI_TIMEOUT_MS', '15000');
    vi.stubEnv('MODEL_DAILY_TOKENS', '500000');
    expect(assistantSettings()).toMatchObject({
      openAITimeoutMs: 15_000,
      dailyModelTokens: 500_000,
    });
  });

  it('reads an empty value as not set', () => {
    vi.stubEnv('OPENAI_TIMEOUT_MS', '');
    expect(assistantSettings()).toMatchObject({ openAITimeoutMs: 20_000 });
  });

  it.each(['zero', '0', '-5', '1.5'])('refuses %j as a limit rather than guessing', (value) => {
    vi.stubEnv('MODEL_ANSWERS_PER_TEN_MINUTES', value);
    expect(() => assistantSettings()).toThrow();
  });
});
