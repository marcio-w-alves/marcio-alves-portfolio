import { describe, expect, it } from 'vitest';
import type { AssistantEvent } from '@/core/chat/events';
import { createAnswerCache } from './answer-cache';

const ANSWER: readonly AssistantEvent[] = [
  { type: 'start', intent: 'model', related: null },
  { type: 'finish', followUps: [], sources: [] },
];

function cache(maxEntries = 10, ttlMs = 1000) {
  let clock = 0;
  return {
    ...createAnswerCache({ ttlMs, maxEntries, now: () => clock }),
    at: (ms: number) => {
      clock = ms;
    },
  };
}

describe('answer cache', () => {
  it('returns a stored answer until it expires', () => {
    const answers = cache();
    answers.set('q', ANSWER);
    answers.at(999);
    expect(answers.get('q')).toBe(ANSWER);
    answers.at(1000);
    expect(answers.get('q')).toBeUndefined();
  });

  it('evicts the oldest entry once full, so it cannot grow without bound', () => {
    const answers = cache(2);
    answers.set('first', ANSWER);
    answers.set('second', ANSWER);
    answers.set('third', ANSWER);
    expect(answers.get('first')).toBeUndefined();
    expect(answers.get('second')).toBe(ANSWER);
    expect(answers.get('third')).toBe(ANSWER);
  });

  it('treats a rewritten entry as the newest', () => {
    const answers = cache(2);
    answers.set('first', ANSWER);
    answers.set('second', ANSWER);
    answers.set('first', ANSWER);
    answers.set('third', ANSWER);
    expect(answers.get('second')).toBeUndefined();
    expect(answers.get('first')).toBe(ANSWER);
  });
});
