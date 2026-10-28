import { describe, expect, it } from 'vitest';
import { assistantSettings } from '@/env';
import { maxDuration } from './route';

describe('the chat route', () => {
  it('lets the function run longer than an answer may take, so the time limit ends it first', () => {
    const { chatRequestTimeoutMs } = assistantSettings();

    expect(maxDuration * 1000).toBeGreaterThan(chatRequestTimeoutMs);
  });
});
