import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantEvent } from '@/core/chat/events';
import type { ChatRequest } from '@/core/chat/request';
import { streamAnswer } from './chat-client';

const ENDPOINT = 'http://portfolio.test/api/chat';
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

const REQUEST: ChatRequest = {
  message: 'What did he do at Roots?',
  history: [],
  context: { topic: 'overview', lastIntent: null, ctaShown: false },
};

const ANSWER: AssistantEvent[] = [
  { type: 'start', intent: 'company:roots', related: { id: 'roots', company: 'Roots' } },
  { type: 'text-start', id: 'p0' },
  { type: 'text-delta', id: 'p0', delta: 'At Roots he led ' },
  { type: 'text-delta', id: 'p0', delta: 'the frontend.' },
  { type: 'text-end', id: 'p0' },
  { type: 'finish', followUps: ['How did he grow the team at Roots?'], sources: [] },
];

/** Encodes events as the server does, split into arbitrary chunks like a real network. */
function sse(events: readonly AssistantEvent[], chunkSize = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  );
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

function answerWith(body: ReadableStream<Uint8Array>) {
  server.use(
    http.post(
      ENDPOINT,
      () => new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    ),
  );
}

async function collect(options: { signal?: AbortSignal; idleTimeoutMs?: number } = {}) {
  return Array.fromAsync(
    streamAnswer(REQUEST, {
      endpoint: ENDPOINT,
      signal: options.signal ?? new AbortController().signal,
      ...(options.idleTimeoutMs ? { idleTimeoutMs: options.idleTimeoutMs } : {}),
    }),
  );
}

describe('streaming an answer', () => {
  it('yields the server events in order, however the bytes are chunked', async () => {
    answerWith(sse(ANSWER, 5));
    expect(await collect()).toEqual(ANSWER);
  });

  it('sends the question, the history and the context as JSON', async () => {
    let received: unknown;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        received = await request.json();
        return new HttpResponse(sse(ANSWER), { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );
    await collect();
    expect(received).toEqual(REQUEST);
  });

  it('skips frames that are not assistant events', async () => {
    const bytes = new TextEncoder().encode(
      `data: not json\n\ndata: {"type":"evil"}\n\n${ANSWER.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}`,
    );
    answerWith(new Blob([bytes]).stream());
    expect(await collect()).toEqual(ANSWER);
  });

  it('skips frames of a known type that do not carry what the type promises', async () => {
    const malformed = [
      { type: 'text-delta', id: 'p0' },
      { type: 'component', id: 'p1', component: 'script', props: {} },
      { type: 'error', error: { code: 'internal' } },
    ];
    answerWith(sse([...malformed, ...ANSWER] as AssistantEvent[]));
    expect(await collect()).toEqual(ANSWER);
  });

  it('reports an answer cut off before it finished', async () => {
    answerWith(sse(ANSWER.slice(0, 3)));
    const events = await collect();
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { code: 'interrupted', retryable: true },
    });
  });
});

describe('when the answer cannot be had', () => {
  it('says when to try again after too many questions', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          { error: { code: 'rate_limited', message: 'Too many questions in a short time.' } },
          { status: 429, headers: { 'Retry-After': '90' } },
        ),
      ),
    );
    expect(await collect()).toEqual([
      {
        type: 'error',
        error: { code: 'rate_limited', retryable: true, retryAfterSeconds: 90 },
      },
    ]);
  });

  it('does not offer to resend a question the server refused as too large', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json({}, { status: 413 })));
    expect(await collect()).toEqual([
      { type: 'error', error: expect.objectContaining({ retryable: false }) as unknown },
    ]);
  });

  it('offers a retry when the server fails', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json({}, { status: 500 })));
    expect(await collect()).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({ code: 'internal', retryable: true }) as unknown,
      },
    ]);
  });

  it('reports a network failure as unreachable', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.error()));
    expect(await collect()).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({ code: 'network', retryable: true }) as unknown,
      },
    ]);
  });

  it('gives up on a stream that goes silent', async () => {
    server.use(
      http.post(ENDPOINT, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      }),
    );
    expect(await collect({ idleTimeoutMs: 50 })).toEqual([
      { type: 'error', error: expect.objectContaining({ code: 'timeout' }) as unknown },
    ]);
  });
});

describe('stopping', () => {
  it('ends quietly when the visitor stops the answer', async () => {
    const stop = new AbortController();
    server.use(
      http.post(ENDPOINT, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      }),
    );
    const pending = collect({ signal: stop.signal });
    stop.abort();
    expect(await pending).toEqual([]);
  });
});
