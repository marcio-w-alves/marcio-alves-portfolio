import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ASSISTANT_EVENT_TYPES, INTERRUPTED, type AssistantEvent } from '@/core/chat/events';
import { EVENT_STREAM_HEADERS, eventStream } from '@/http/event-stream';
import { streamAnswer } from '@/ui/chat/chat-client';

const ENDPOINT = 'http://portfolio.test/api/chat';

// Keyed by the event union: a new event type does not compile until it has a sample here.
const SAMPLES: {
  readonly [Type in AssistantEvent['type']]: Extract<AssistantEvent, { type: Type }>;
} = {
  start: { type: 'start', intent: 'company:globex', related: { id: 'globex', company: 'Globex' } },
  'text-start': { type: 'text-start', id: 'p0' },
  'text-delta': { type: 'text-delta', id: 'p0', delta: 'She led the “platform” — in 2021.' },
  'text-end': { type: 'text-end', id: 'p0' },
  component: {
    type: 'component',
    id: 'p1',
    component: 'metrics',
    props: { items: [{ value: '40%', label: 'faster builds', context: 'CI' }] },
  },
  finish: {
    type: 'finish',
    followUps: ['How did she grow the team?'],
    sources: [
      { id: 'globex', label: 'Globex' },
      { id: 'web', label: 'Article', url: 'https://example.com/a' },
    ],
  },
  error: INTERRUPTED,
};

const FINISH = SAMPLES.finish;

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

async function* emit(events: readonly AssistantEvent[]) {
  for (const event of events) yield await Promise.resolve(event);
}

/** The server's real stream, read back by the browser's real client. */
async function roundTrip(events: readonly AssistantEvent[]): Promise<AssistantEvent[]> {
  server.use(
    http.post(
      ENDPOINT,
      () =>
        new Response(
          eventStream(emit(events), () => undefined),
          { headers: EVENT_STREAM_HEADERS },
        ),
    ),
  );
  return Array.fromAsync(
    streamAnswer(
      {
        message: 'What did she do at Globex?',
        history: [],
        context: { topic: 'overview', lastIntent: null, ctaShown: false },
      },
      { endpoint: ENDPOINT, signal: new AbortController().signal },
    ),
  );
}

describe('the wire contract between the server and the browser', () => {
  it.each(ASSISTANT_EVENT_TYPES)(
    'reads back a %s event exactly as the server sent it',
    async (type) => {
      const event = SAMPLES[type];
      const answer = type === 'finish' || type === 'error' ? [event] : [event, FINISH];

      expect(await roundTrip(answer)).toEqual(answer);
    },
  );

  it('reads back a whole answer in order', async () => {
    const answer = ASSISTANT_EVENT_TYPES.filter((type) => type !== 'error').map(
      (type) => SAMPLES[type],
    );

    expect(await roundTrip(answer)).toEqual(answer);
  });
});
