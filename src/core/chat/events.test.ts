import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_EVENT_TYPES,
  INTERRUPTED,
  isAssistantEvent,
  type AssistantEvent,
} from './events';

const VALID: {
  readonly [Type in AssistantEvent['type']]: Extract<AssistantEvent, { type: Type }>;
} = {
  start: { type: 'start', intent: 'company:acme', related: null },
  'text-start': { type: 'text-start', id: 'p0' },
  'text-delta': { type: 'text-delta', id: 'p0', delta: 'At Acme' },
  'text-end': { type: 'text-end', id: 'p0' },
  component: { type: 'component', id: 'p1', component: 'note', props: { tone: 'info', text: 'x' } },
  finish: {
    type: 'finish',
    followUps: ['Next?'],
    sources: [{ id: 'acme', label: 'Acme', url: 'https://example.com' }],
  },
  error: {
    type: 'error',
    error: { code: 'rate_limited', retryable: true, retryAfterSeconds: 90 },
  },
};

describe('reading an event off the wire', () => {
  it.each(ASSISTANT_EVENT_TYPES)('accepts a well-formed %s event', (type) => {
    expect(isAssistantEvent(VALID[type])).toBe(true);
  });

  it('accepts the interrupted error the server ends a broken answer with', () => {
    expect(isAssistantEvent(INTERRUPTED)).toBe(true);
  });

  it.each([
    ['not an object', 'start'],
    ['null', null],
    ['an unknown type', { type: 'evil' }],
    ['a type inherited from every object', { type: 'constructor' }],
    ['a start without an intent', { type: 'start', related: null }],
    ['a start whose related role is not a name', { type: 'start', intent: 'x', related: 3 }],
    ['a text part without an id', { type: 'text-start' }],
    ['a text delta without its text', { type: 'text-delta', id: 'p0' }],
    ['a text end without an id', { type: 'text-end', id: 7 }],
    [
      'a component outside the allow-list',
      { type: 'component', id: 'p1', component: 'script', props: {} },
    ],
    ['a component without props', { type: 'component', id: 'p1', component: 'note' }],
    ['a finish whose follow-ups are not text', { type: 'finish', followUps: [1], sources: [] }],
    [
      'a finish with a source missing its label',
      { type: 'finish', followUps: [], sources: [{ id: 'a' }] },
    ],
    [
      'a finish with a source whose link is not text',
      { type: 'finish', followUps: [], sources: [{ id: 'a', label: 'A', url: 1 }] },
    ],
    ['an error with an unknown code', { type: 'error', error: { code: 'boom', retryable: true } }],
    [
      'an error that does not say if it can be retried',
      { type: 'error', error: { code: 'internal' } },
    ],
    [
      'an error whose wait is not a number',
      { type: 'error', error: { code: 'rate_limited', retryable: true, retryAfterSeconds: '90' } },
    ],
    ['an error without its error', { type: 'error' }],
  ])('rejects %s', (_, value) => {
    expect(isAssistantEvent(value)).toBe(false);
  });
});
