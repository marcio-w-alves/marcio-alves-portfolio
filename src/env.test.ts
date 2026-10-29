import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantSettings } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assistant settings', () => {
  it('uses the defaults when a deployment sets nothing', () => {
    expect(assistantSettings()).toEqual({
      chatModel: 'gpt-4o-mini',
      openAITimeoutMs: 20_000,
      requestsPerTenMinutes: 40,
      modelAnswersPerTenMinutes: 15,
      dailyModelTokens: 2_000_000,
      clientDailyModelTokens: 150_000,
      chatRequestTimeoutMs: 60_000,
    });
  });

  it('takes what the deployment sets, numbers included', () => {
    vi.stubEnv('OPENAI_CHAT_MODEL', 'gpt-5.4-mini');
    vi.stubEnv('MODEL_DAILY_TOKENS', '500000');
    expect(assistantSettings()).toMatchObject({
      chatModel: 'gpt-5.4-mini',
      dailyModelTokens: 500_000,
    });
  });

  it('reads an empty value as not set', () => {
    vi.stubEnv('OPENAI_CHAT_MODEL', '');
    vi.stubEnv('OPENAI_TIMEOUT_MS', '');
    expect(assistantSettings()).toMatchObject({
      chatModel: 'gpt-4o-mini',
      openAITimeoutMs: 20_000,
    });
  });

  it.each(['zero', '0', '-5', '1.5'])('refuses %j as a limit rather than guessing', (value) => {
    vi.stubEnv('MODEL_ANSWERS_PER_TEN_MINUTES', value);
    expect(() => assistantSettings()).toThrow();
  });

  it('takes the overall time limit a deployment sets for an answer', () => {
    vi.stubEnv('CHAT_REQUEST_TIMEOUT_MS', '45000');
    expect(assistantSettings()).toMatchObject({ chatRequestTimeoutMs: 45_000 });
  });

  it.each(['soon', '0', '-1000', '75000'])('refuses %j as the overall time limit', (value) => {
    vi.stubEnv('CHAT_REQUEST_TIMEOUT_MS', value);
    expect(() => assistantSettings()).toThrow();
  });
});
