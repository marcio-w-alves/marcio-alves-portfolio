import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { APIConnectionTimeoutError } from 'openai';
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContainer } from '@/composition-root';
import type { AnswerSource, AssistantEvent } from '@/core/assistant/assistant-event';
import { ModelStreamStalledError } from '@/infrastructure/openai/openai-language-model';
import knowledgeIndex from '@/infrastructure/retrieval/knowledge-index.json';
import { createChatHandler } from './chat-handler';

/**
 * The route as it runs in production — the real composition, the real OpenAI
 * SDK, the real actions and the real event stream — with only the network
 * replaced. Every request that leaves the process is answered here, or fails
 * the test.
 */

const COMPLETIONS = 'https://api.openai.com/v1/chat/completions';
const EMBEDDINGS = 'https://api.openai.com/v1/embeddings';
const TEST_TIMEOUT_MS = 50;

const server = setupServer();
const outbound: Request[] = [];
/** What the composition reported to whoever operates the site. */
let reported: unknown[] = [];

// A fresh connection pool per test: MSW's emulated socket for an exchange
// aborted mid-stream can still be tearing down when the next test connects.
const sharedConnections = getGlobalDispatcher();
let connections: Agent;

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  server.events.on('request:start', ({ request }) => outbound.push(request));
});
beforeEach(() => {
  outbound.length = 0;
  reported = [];
  vi.spyOn(console, 'error').mockImplementation((_label: unknown, error: unknown) => {
    reported.push(error);
  });
  connections = new Agent();
  setGlobalDispatcher(connections);
});
afterEach(async () => {
  server.resetHandlers();
  vi.useRealTimers();
  await connections.destroy();
});
afterAll(() => {
  setGlobalDispatcher(sharedConnections);
  server.close();
});

function postChat(): (request: Request) => Promise<Response> {
  return createChatHandler(
    buildContainer({
      env: { OPENAI_API_KEY: 'test-key', GITHUB_TOKEN: undefined },
      openAITimeoutMs: TEST_TIMEOUT_MS,
    }),
  );
}

/**
 * The signal every outbound request carries. Once a mocked response has
 * started streaming MSW no longer reports the client aborting it, so the fetch
 * the SDK calls is watched — and called through — instead.
 */
function watchOutboundSignals(): AbortSignal[] {
  const signals: AbortSignal[] = [];
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.signal) signals.push(init.signal);
    return realFetch(input, init);
  });
  return signals;
}

let visitors = 0;
/** The model budget is shared by every container, so each test asks as a visitor of its own. */
function newVisitor(): string {
  visitors += 1;
  return `203.0.113.${String(visitors)}`;
}

function question(
  message: string,
  { ip = newVisitor(), signal }: { ip?: string; signal?: AbortSignal } = {},
): Request {
  return new Request('https://marciomariani.dev/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ message }),
    ...(signal ? { signal } : {}),
  });
}

/** Reads the answer frame by frame, as the interface's transport does. */
async function* eventsOf(response: Response): AsyncGenerator<AssistantEvent, void> {
  if (!response.body) return;
  const decoder = new TextDecoder();
  let buffered = '';
  for await (const bytes of response.body) {
    buffered += decoder.decode(bytes, { stream: true });
    let end = buffered.indexOf('\n\n');
    while (end >= 0) {
      const frame = buffered.slice(0, end);
      buffered = buffered.slice(end + 2);
      if (frame.startsWith('data: ')) {
        yield JSON.parse(frame.slice('data: '.length)) as AssistantEvent;
      }
      end = buffered.indexOf('\n\n');
    }
  }
}

async function allEventsOf(response: Response): Promise<AssistantEvent[]> {
  return Array.fromAsync(eventsOf(response));
}

function textOf(events: readonly AssistantEvent[]): string {
  return events.map((event) => (event.type === 'text-delta' ? event.delta : '')).join('');
}

function sourcesOf(events: readonly AssistantEvent[]): readonly AnswerSource[] {
  const finish = events.at(-1);
  return finish?.type === 'finish' ? finish.sources : [];
}

function chunk(delta: object, finishReason: string | null = null): object {
  return {
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'gpt-4o-mini',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

const USAGE = {
  id: 'chatcmpl-1',
  object: 'chat.completion.chunk',
  created: 1,
  model: 'gpt-4o-mini',
  choices: [],
  usage: { prompt_tokens: 300, completion_tokens: 20, total_tokens: 320 },
};

// Chunked, as OpenAI frames it: without a length or chunking, the end of the
// body would be the connection closing.
const STREAM_HEADERS = { 'Content-Type': 'text/event-stream', 'Transfer-Encoding': 'chunked' };

function frames(chunks: readonly object[]): Uint8Array[] {
  const encoder = new TextEncoder();
  return chunks.map((item) => encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
}

/** A complete streamed completion: every chunk, then [DONE]. */
function completion(chunks: readonly object[]): HttpResponse<ReadableStream> {
  const encoded = [...frames(chunks), new TextEncoder().encode('data: [DONE]\n\n')];
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        for (const frame of encoded) controller.enqueue(frame);
        controller.close();
      },
    }),
    { headers: STREAM_HEADERS },
  );
}

/** A completion that starts streaming and then goes quiet, the connection still open. */
function stalledCompletion(chunks: readonly object[]): HttpResponse<ReadableStream> {
  const encoded = frames(chunks);
  return new HttpResponse(
    new ReadableStream({
      start(controller) {
        for (const frame of encoded) controller.enqueue(frame);
      },
    }),
    { headers: STREAM_HEADERS },
  );
}

/** Never answers; the network error once the client gives up goes to nobody. */
function noResponseUntilAborted(request: Request): Promise<Response> {
  return new Promise((resolve) => {
    request.signal.addEventListener('abort', () => {
      resolve(HttpResponse.error());
    });
  });
}

function toolCallRound(name: string, args: string): object[] {
  const half = Math.floor(args.length / 2);
  return [
    chunk({
      role: 'assistant',
      content: null,
      tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name, arguments: '' } }],
    }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(0, half) } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(half) } }] }),
    chunk({}, 'tool_calls'),
    USAGE,
  ];
}

function textRound(...deltas: string[]): object[] {
  return [
    chunk({ role: 'assistant', content: '' }),
    ...deltas.map((content) => chunk({ content })),
    chunk({}, 'stop'),
    USAGE,
  ];
}

interface OpenAIMessage {
  readonly role: string;
  readonly content: string | null;
  readonly tool_call_id?: string;
  readonly tool_calls?: readonly { id: string; function: { name: string } }[];
}

interface CompletionRequest {
  readonly tool_choice: string;
  readonly tools: readonly { function: { name: string } }[];
  readonly messages: readonly OpenAIMessage[];
}

/** Answers each round in turn, keeping what the assistant sent for each. */
function scriptedCompletions(...rounds: readonly object[][]): CompletionRequest[] {
  const received: CompletionRequest[] = [];
  server.use(
    http.post(COMPLETIONS, async ({ request }) => {
      received.push((await request.json()) as CompletionRequest);
      return completion(rounds[received.length - 1] ?? textRound('unexpected round'));
    }),
  );
  return received;
}

const TOPTAL_VECTOR = knowledgeIndex.vectors['role:toptal'];

function base64Floats(vector: readonly number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString('base64');
}

const FALLBACK_START = { type: 'start', intent: 'unknown', related: null };
const MODEL_QUESTION = 'Compare Roots and Deel.';

describe('POST /api/chat — the fast path', () => {
  it('answers a question it recognizes without calling OpenAI', async () => {
    const response = await postChat()(question("Tell me about Marcio's career."));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const events = await allEventsOf(response);
    expect(events[0]).toEqual({ type: 'start', intent: 'career', related: 'deel' });
    expect(events.at(-1)?.type).toBe('finish');
    expect(outbound).toEqual([]);
  });
});

describe('POST /api/chat — a model answer', () => {
  it('runs the action OpenAI asks for, returns its result, and streams the answer built on it', async () => {
    const sent = scriptedCompletions(
      toolCallRound('getExperience', '{"company":"roots"}'),
      textRound('He led ', 'the Roots frontend.'),
    );

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    expect(events.map((event) => event.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'finish',
    ]);
    expect(events[0]).toEqual({ type: 'start', intent: 'model', related: null });
    expect(textOf(events)).toBe('He led the Roots frontend.');
    expect(events.at(-1)).toMatchObject({
      type: 'finish',
      sources: [{ id: 'resume.roots', label: 'Resume · Roots experience' }],
    });

    const [first, second] = sent;
    expect(sent).toHaveLength(2);
    expect(first?.tool_choice).toBe('auto');
    expect(first?.tools.map((tool) => tool.function.name)).toContain('getExperience');
    expect(first?.messages.at(-1)).toEqual({ role: 'user', content: MODEL_QUESTION });
    const [toolCall, toolResult] = second?.messages.slice(-2) ?? [];
    expect(toolCall).toMatchObject({
      role: 'assistant',
      tool_calls: [{ id: 'call_1', function: { name: 'getExperience' } }],
    });
    expect(toolResult).toMatchObject({ role: 'tool', tool_call_id: 'call_1' });
    expect(JSON.parse(toolResult?.content ?? 'null')).toEqual([
      expect.objectContaining({ id: 'roots', company: 'Roots' }),
    ]);
  });

  it('searches the record through OpenAI embeddings and cites what it found', async () => {
    let embeddingRequest: unknown;
    server.use(
      http.post(EMBEDDINGS, async ({ request }) => {
        embeddingRequest = await request.json();
        return HttpResponse.json({
          object: 'list',
          model: 'text-embedding-3-small',
          // The query lands exactly on the indexed Toptal role, sent as the
          // base64 floats the SDK asks for.
          data: [{ object: 'embedding', index: 0, embedding: base64Floats(TOPTAL_VECTOR) }],
          usage: { prompt_tokens: 5, total_tokens: 5 },
        });
      }),
    );
    scriptedCompletions(
      toolCallRound('searchKnowledge', '{"query":"talent marketplace work"}'),
      textRound('He worked at Toptal.'),
    );

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    expect(embeddingRequest).toMatchObject({
      model: 'text-embedding-3-small',
      input: ['talent marketplace work'],
      dimensions: 512,
    });
    expect(textOf(events)).toBe('He worked at Toptal.');
    expect(sourcesOf(events)).toContainEqual({
      id: 'resume.toptal',
      label: 'Resume · Toptal experience',
    });
  });
});

describe('POST /api/chat — when OpenAI fails', () => {
  it.each([429, 500, 503])(
    'retries a %i once, then answers honestly without the model',
    async (status) => {
      server.use(
        http.post(COMPLETIONS, () =>
          HttpResponse.json(
            { error: { message: 'stubbed failure', type: 'server_error' } },
            // OpenAI's own hint for when to retry; zero keeps the test from waiting.
            { status, headers: { 'retry-after-ms': '0' } },
          ),
        ),
      );

      const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

      expect(outbound.filter((request) => request.url === COMPLETIONS)).toHaveLength(2);
      expect(events[0]).toEqual(FALLBACK_START);
      expect(events.at(-1)).toMatchObject({ type: 'finish', sources: [] });
      expect(events.some((event) => event.type === 'error')).toBe(false);
      expect(reported).toEqual([expect.objectContaining({ status })]);
    },
  );

  it('gives up on a response that never comes, after the configured timeout and one retry', async () => {
    server.use(http.post(COMPLETIONS, ({ request }) => noResponseUntilAborted(request)));

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    const attempts = outbound.filter((request) => request.url === COMPLETIONS);
    expect(attempts).toHaveLength(2);
    expect(attempts.every((attempt) => attempt.signal.aborted)).toBe(true);
    expect(events[0]).toEqual(FALLBACK_START);
    expect(events.at(-1)).toMatchObject({ type: 'finish', sources: [] });
    expect(reported).toEqual([expect.any(APIConnectionTimeoutError)]);
  });

  it('ends an answer whose stream goes quiet, with a retryable error, after the configured timeout', async () => {
    const signals = watchOutboundSignals();
    server.use(
      http.post(COMPLETIONS, () =>
        stalledCompletion([
          chunk({ role: 'assistant', content: '' }),
          chunk({ content: 'He led ' }),
        ]),
      ),
    );

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    expect(events.map((event) => event.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'error',
    ]);
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: {
        code: 'internal',
        message: 'The answer was interrupted. Please try again.',
        retryable: true,
      },
    });
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    expect(reported).toEqual([expect.any(ModelStreamStalledError)]);
  });
});

describe('POST /api/chat — a visitor who leaves mid-answer', () => {
  it('aborts the OpenAI request, emits and reports nothing more, and keeps the half answer out of the cache', async () => {
    const signals = watchOutboundSignals();
    server.use(
      http.post(COMPLETIONS, () =>
        stalledCompletion([
          chunk({ role: 'assistant', content: '' }),
          chunk({ content: 'He led ' }),
        ]),
      ),
    );
    const handle = postChat();
    const visitor = newVisitor();
    const leaving = new AbortController();

    const answer = eventsOf(
      await handle(question(MODEL_QUESTION, { ip: visitor, signal: leaving.signal })),
    );
    // Read by hand: leaving a for-await loop would cancel the body itself.
    const seenBeforeLeaving = [await answer.next(), await answer.next(), await answer.next()].map(
      (next) => next.value,
    );
    leaving.abort();

    expect(seenBeforeLeaving.map((event) => event?.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
    ]);
    expect(await Array.fromAsync(answer)).toEqual([]);
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    expect(reported).toEqual([]);

    scriptedCompletions(textRound('He led the Roots frontend.'));
    const asked = await allEventsOf(await handle(question(MODEL_QUESTION, { ip: visitor })));
    expect(textOf(asked)).toBe('He led the Roots frontend.');
  });
});

describe('POST /api/chat — pacing', () => {
  it('turns a client away after forty requests in ten minutes, saying when to retry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const handle = postChat();
    const visitor = newVisitor();

    for (let request = 0; request < 40; request += 1) {
      expect((await handle(question('hi', { ip: visitor }))).status).toBe(200);
    }
    const refused = await handle(question(MODEL_QUESTION, { ip: visitor }));

    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('600');
    expect(await refused.json()).toEqual({
      error: { code: 'rate_limited', message: 'Too many questions in a short time.' },
    });
    expect((await handle(question('hi'))).status).toBe(200);
    expect(outbound).toEqual([]);
  });
});
