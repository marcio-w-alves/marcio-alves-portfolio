import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantEvent } from '@/core/chat/events';
import { EVENT_STREAM_HEADERS, eventStream } from '@/http/event-stream';
import { streamAnswer } from '@/ui/chat/chat-client';

/**
 * The server's heartbeat and the browser's idle limit are two halves of one
 * contract: a model that consults actions for longer than the browser's
 * patience must not cost the visitor the answer.
 */

const ENDPOINT = 'http://portfolio.test/api/chat';
const SILENCE_MS = 40_000;
const CLIENT_PATIENCE_MS = 30_000;

const START: AssistantEvent = { type: 'start', intent: 'model', related: null };
const FINISH: AssistantEvent = { type: 'finish', followUps: [], sources: [] };

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

/** Starts, then says nothing for SILENCE_MS before it finishes — as a model busy with actions. */
async function* slowAnswer() {
  yield START;
  yield await new Promise<AssistantEvent>((resolve) => {
    setTimeout(() => {
      resolve(FINISH);
    }, SILENCE_MS);
  });
}

async function ask({
  heartbeatMs,
  waitedMs,
}: {
  readonly heartbeatMs: number;
  readonly waitedMs: number;
}): Promise<AssistantEvent[]> {
  server.use(
    http.post(
      ENDPOINT,
      () =>
        new Response(
          eventStream(slowAnswer(), () => undefined, { heartbeatMs }),
          {
            // Chunked, as the platform sends it: otherwise the end of the body
            // would be the connection closing, even after the client gave up.
            headers: { ...EVENT_STREAM_HEADERS, 'Transfer-Encoding': 'chunked' },
          },
        ),
    ),
  );
  const answer = Array.fromAsync(
    streamAnswer(
      {
        message: 'Compare Globex and Acme.',
        history: [],
        context: { topic: 'overview', lastIntent: null, ctaShown: false },
        locale: 'en',
      },
      { endpoint: ENDPOINT, signal: new AbortController().signal },
    ),
  );
  await vi.advanceTimersByTimeAsync(waitedMs);
  return answer;
}

describe('a long silence before the answer', () => {
  it('is survived by the real client thanks to the server heartbeats', async () => {
    expect(await ask({ heartbeatMs: 10_000, waitedMs: SILENCE_MS })).toEqual([START, FINISH]);
  });

  it('times out in the real client when heartbeats come slower than its patience', async () => {
    expect(await ask({ heartbeatMs: SILENCE_MS, waitedMs: CLIENT_PATIENCE_MS })).toEqual([
      START,
      { type: 'error', error: { code: 'timeout', retryable: true } },
    ]);
  });
});
