import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContainer } from '@/composition-root';
import type { AnswerSource, AssistantEvent } from '@/core/chat/events';
import { assistantSettings } from '@/env';
import { MAX_OUTPUT_TOKENS } from '@/core/assistant/system2/model-assistant';
import { SEARCH_UNAVAILABLE } from '@/core/assistant/tools/search-tools';
import { profile } from '@/profile';
import knowledgeIndex from '@/profile/generated/knowledge-index.json';
import { createHealthHandler } from './health-handler';
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
/** The failures the site logged for whoever operates it, as structured log lines. */
let reported: Record<string, unknown>[] = [];
/** Every structured line the site logged. */
let logged: Record<string, unknown>[] = [];

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
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    const entry = JSON.parse(String(line)) as Record<string, unknown>;
    logged.push(entry);
    if (entry.event === 'assistant.failed') reported.push(entry);
  });
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logged.push(JSON.parse(String(line)) as Record<string, unknown>);
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

interface TestSettings {
  readonly dailyModelTokens?: number;
  readonly openAITimeoutMs?: number;
  readonly chatRequestTimeoutMs?: number;
}

function testContainer({
  dailyModelTokens,
  openAITimeoutMs = TEST_TIMEOUT_MS,
  chatRequestTimeoutMs,
}: TestSettings = {}) {
  const settings = assistantSettings();
  return buildContainer({
    env: { OPENAI_API_KEY: 'test-key', GITHUB_TOKEN: undefined },
    settings: {
      ...settings,
      dailyModelTokens: dailyModelTokens ?? settings.dailyModelTokens,
      chatRequestTimeoutMs: chatRequestTimeoutMs ?? settings.chatRequestTimeoutMs,
    },
    openAITimeoutMs,
  });
}

function postChat(testSettings: TestSettings = {}): (request: Request) => Promise<Response> {
  return createChatHandler(testContainer(testSettings));
}

function loggedEvents(event: string): Record<string, unknown>[] {
  return logged.filter((entry) => entry.event === event);
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

const WAY2B1_VECTOR = knowledgeIndex.vectors['role:way2b1'];

function base64Floats(vector: readonly number[]): string {
  return Buffer.from(new Float32Array(vector).buffer).toString('base64');
}

const FALLBACK_START = { type: 'start', intent: 'unknown', related: null };
const INTERRUPTED_EVENT = { type: 'error', error: { code: 'interrupted', retryable: true } };
const MODEL_QUESTION = 'Compare Roots and Deel.';

describe('POST /api/chat — the fast path', () => {
  it('answers a question it recognizes without calling OpenAI', async () => {
    const response = await postChat()(question("Tell me about Marcio's career."));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const events = await allEventsOf(response);
    expect(events[0]).toEqual({
      type: 'start',
      intent: 'career',
      related: { id: 'deel', company: 'Deel' },
    });
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

    const types = events.map((event) => event.type);
    expect(types.filter((type, index) => type !== types[index - 1])).toEqual([
      'start',
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);
    expect(types.filter((type) => type === 'text-delta').length).toBeGreaterThan(1);
    expect(events[0]).toEqual({ type: 'start', intent: 'model', related: null });
    expect(textOf(events)).toBe('He led the Roots frontend.');
    expect(events.at(-1)).toMatchObject({
      type: 'finish',
      sources: [{ id: 'resume.roots', label: 'Resume' }],
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
          // The query lands exactly on the indexed Way2b1 role, sent as the
          // base64 floats the SDK asks for.
          data: [{ object: 'embedding', index: 0, embedding: base64Floats(WAY2B1_VECTOR) }],
          usage: { prompt_tokens: 5, total_tokens: 5 },
        });
      }),
    );
    scriptedCompletions(
      toolCallRound('searchKnowledge', '{"query":"talent marketplace work"}'),
      textRound('He worked at Way2b1.'),
    );

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    expect(embeddingRequest).toMatchObject({
      model: 'text-embedding-3-small',
      input: ['talent marketplace work'],
      dimensions: 512,
    });
    expect(textOf(events)).toBe('He worked at Way2b1.');
    expect(sourcesOf(events)).toContainEqual({
      id: 'resume.way2b1',
      label: 'Resume',
    });
  });

  it("links to the record's own addresses with no action, and to nothing else", async () => {
    scriptedCompletions(
      textRound(
        'See [his GitHub](https://github.com/marcio-w-alves), [email him](mailto:',
        `${profile.knowledge.contact.email}) or [log in](https://evil.example/login).`,
      ),
    );

    const events = await allEventsOf(await postChat()(question(MODEL_QUESTION)));

    expect(textOf(events)).toBe(
      `See [his GitHub](https://github.com/marcio-w-alves), [email him](mailto:${profile.knowledge.contact.email}) or log in.`,
    );
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
      expect(reported).toEqual([
        expect.objectContaining({
          errorMessage: expect.stringContaining(String(status)) as unknown,
        }),
      ]);
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
    expect(reported).toEqual([expect.objectContaining({ errorMessage: 'Request timed out.' })]);
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
      error: { code: 'interrupted', retryable: true },
    });
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    expect(reported).toEqual([expect.objectContaining({ errorName: 'ModelStreamStalledError' })]);
  });
});

describe('POST /api/chat — when retrieval is down', () => {
  it('still answers without search, opening only the retrieval circuit', async () => {
    server.use(
      http.post(EMBEDDINGS, () =>
        HttpResponse.json({ error: { message: 'stubbed outage' } }, { status: 500 }),
      ),
    );
    // Each question searches, then answers from what the search returned.
    const sent: CompletionRequest[] = [];
    server.use(
      http.post(COMPLETIONS, async ({ request }) => {
        sent.push((await request.json()) as CompletionRequest);
        return completion(
          sent.length % 2 === 1
            ? toolCallRound('searchKnowledge', '{"query":"Roots backend"}')
            : textRound('That is not something I can look up right now.'),
        );
      }),
    );
    const container = buildContainer({
      env: { OPENAI_API_KEY: 'test-key', GITHUB_TOKEN: undefined },
      openAITimeoutMs: TEST_TIMEOUT_MS,
    });
    const ask = createChatHandler(container);

    const answers: AssistantEvent[][] = [];
    for (const company of ['Roots', 'Deel', 'Way2b1', 'Shall']) {
      answers.push(await allEventsOf(await ask(question(`Compare ${company} and Deel.`))));
    }

    for (const events of answers) {
      expect(events[0]).toEqual({ type: 'start', intent: 'model', related: null });
      expect(textOf(events)).toBe('That is not something I can look up right now.');
      expect(events.at(-1)?.type).toBe('finish');
    }
    expect(outbound.filter((request) => request.url === EMBEDDINGS)).toHaveLength(3);
    const lastToolReply = sent.at(-1)?.messages.at(-1);
    expect(JSON.parse(lastToolReply?.content ?? 'null')).toEqual({
      passages: [],
      note: SEARCH_UNAVAILABLE,
    });
    expect(await createHealthHandler(container)().json()).toMatchObject({
      circuit: 'closed',
      retrieval: 'open',
    });
    expect(loggedEvents('retrieval.circuit_opened')).toHaveLength(1);
    expect(loggedEvents('tool.failed').map((entry) => entry.tool)).toEqual(
      Array.from({ length: 4 }, () => 'searchKnowledge'),
    );
    expect(reported).toEqual([]);
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

describe('POST /api/chat — an answer past its time limit', () => {
  // Far beyond the time limit, so only the limit can end these answers.
  const PATIENT_TIMEOUT_MS = 10_000;
  const TIME_LIMIT_MS = 200;

  const outOfTime = (testSettings: TestSettings = {}) =>
    testContainer({
      openAITimeoutMs: PATIENT_TIMEOUT_MS,
      chatRequestTimeoutMs: TIME_LIMIT_MS,
      ...testSettings,
    });

  it('ends with the interrupted event and stops the OpenAI call', async () => {
    const signals = watchOutboundSignals();
    server.use(
      http.post(COMPLETIONS, () =>
        stalledCompletion([chunk({ role: 'assistant', content: '' }), chunk({ content: 'He ' })]),
      ),
    );

    const events = await allEventsOf(
      await createChatHandler(outOfTime())(question(MODEL_QUESTION)),
    );

    expect(events.map((event) => event.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'error',
    ]);
    expect(events.at(-1)).toEqual(INTERRUPTED_EVENT);
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);
    await vi.waitFor(() => {
      expect(loggedEvents('chat.answered')).toMatchObject([{ outcome: 'interrupted' }]);
    });
    expect(reported).toEqual([]);
  });

  it('ends with the interrupted event while the model is still consulting actions', async () => {
    server.use(http.post(COMPLETIONS, ({ request }) => noResponseUntilAborted(request)));

    const events = await allEventsOf(
      await createChatHandler(outOfTime())(question(MODEL_QUESTION)),
    );

    expect(events).toEqual([INTERRUPTED_EVENT]);
    expect(
      outbound.filter((request) => request.url === COMPLETIONS).map((r) => r.signal.aborted),
    ).toEqual([true]);
    await vi.waitFor(() => {
      expect(loggedEvents('chat.answered')).toMatchObject([{ outcome: 'interrupted' }]);
    });
    expect(reported).toEqual([]);
  });

  it('counts against neither circuit breaker, however often it happens', async () => {
    // Every answer waits on OpenAI past the time limit: three in a row on the
    // model, as many as open its circuit, then three on the search.
    let rounds = 0;
    server.use(
      http.post(COMPLETIONS, ({ request }) => {
        rounds += 1;
        return rounds <= 3
          ? noResponseUntilAborted(request)
          : completion(toolCallRound('searchKnowledge', '{"query":"Roots backend"}'));
      }),
      http.post(EMBEDDINGS, ({ request }) => noResponseUntilAborted(request)),
    );
    const container = outOfTime();
    const ask = createChatHandler(container);

    const companies = ['Roots', 'Deel', 'Way2b1', 'Shall', 'Toptal', 'Acme'];
    for (const [index, company] of companies.entries()) {
      const events = await allEventsOf(await ask(question(`Compare ${company} and Deel.`)));
      expect(events.at(-1)).toEqual(INTERRUPTED_EVENT);
      // The visitor is told at once; the abandoned calls finish unwinding after.
      await vi.waitFor(() => {
        expect(loggedEvents('chat.answered')).toHaveLength(index + 1);
      });
    }

    expect(outbound.filter((request) => request.url === EMBEDDINGS)).toHaveLength(3);
    expect(await createHealthHandler(container)().json()).toMatchObject({
      circuit: 'closed',
      retrieval: 'closed',
    });
    expect(loggedEvents('model.circuit_opened')).toEqual([]);
    expect(loggedEvents('retrieval.circuit_opened')).toEqual([]);
  });

  it('stops the OpenAI call and logs an abandoned answer when the visitor closes the stream', async () => {
    server.use(http.post(COMPLETIONS, ({ request }) => noResponseUntilAborted(request)));
    // The connection closing is all the platform may report: the request's own
    // signal cannot be relied on once the platform has let the request go.
    const response = await createChatHandler(outOfTime())(question(MODEL_QUESTION));
    await vi.waitFor(() => {
      expect(outbound.filter((request) => request.url === COMPLETIONS)).toHaveLength(1);
    });

    await response.body?.cancel();

    await vi.waitFor(() => {
      expect(loggedEvents('chat.answered')).toMatchObject([{ outcome: 'abandoned' }]);
    });
    expect(
      outbound.filter((request) => request.url === COMPLETIONS).map((r) => r.signal.aborted),
    ).toEqual([true]);
    expect(reported).toEqual([]);
  });

  it('is told apart from a visitor leaving, who gets no interrupted event and no failure', async () => {
    server.use(http.post(COMPLETIONS, ({ request }) => noResponseUntilAborted(request)));
    const leaving = new AbortController();
    const asked = question(MODEL_QUESTION, { signal: leaving.signal });

    const answer = allEventsOf(await postChat({ openAITimeoutMs: PATIENT_TIMEOUT_MS })(asked));
    await vi.waitFor(() => {
      expect(outbound.filter((request) => request.url === COMPLETIONS)).toHaveLength(1);
    });
    leaving.abort();

    expect(await answer).toEqual([]);
    // Held to the end, as the platform holds a request while its connection
    // is open: undici stops forwarding the abort to a collected Request's signal.
    expect(asked.signal.aborted).toBe(true);
    await vi.waitFor(() => {
      expect(loggedEvents('chat.answered')).toMatchObject([{ outcome: 'abandoned' }]);
    });
    expect(reported).toEqual([]);
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

describe('POST /api/chat — the spending budget', () => {
  const DELTAS = ['He led ', 'the Roots ', 'frontend at the time'];
  const SEARCH_ARGUMENTS = '{"query":"did he work on the Roots backend"}';
  /** What a round streams before it is cut short, and how many characters of it the visitor's answer used. */
  const ROUNDS = {
    'a written answer': {
      chunks: [
        chunk({ role: 'assistant', content: '' }),
        ...DELTAS.map((content) => chunk({ content })),
      ],
      receivedChars: DELTAS.join('').length,
    },
    'an action call': {
      // The fragments of a call, without the chunk that ends the round or reports usage.
      chunks: toolCallRound('searchKnowledge', SEARCH_ARGUMENTS).slice(0, 3),
      receivedChars: SEARCH_ARGUMENTS.length,
    },
  } as const;
  type RoundKind = keyof typeof ROUNDS;
  const INTERRUPTIONS = [
    'the visitor leaving',
    'a provider failure mid-stream',
    'a stall',
  ] as const;
  type Interruption = (typeof INTERRUPTIONS)[number];

  // Long enough that an answer the visitor abandons cannot also stall.
  const PATIENT_TIMEOUT_MS = 10_000;

  let openAIResponses = 0;
  beforeEach(() => {
    openAIResponses = 0;
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const response = await realFetch(input, init);
      openAIResponses += 1;
      return response;
    });
  });

  /** Streams the round's chunks, then cuts the round short as `how` says; returns the bodies OpenAI got. */
  function interruptedCompletions(kind: RoundKind, how: Interruption): string[] {
    const { chunks } = ROUNDS[kind];
    const failure = { error: { message: 'The server had an error.', type: 'server_error' } };
    const bodies: string[] = [];
    server.use(
      http.post(COMPLETIONS, async ({ request }) => {
        bodies.push(await request.text());
        return how === 'a provider failure mid-stream'
          ? completion([...chunks, failure])
          : stalledCompletion(chunks);
      }),
    );
    return bodies;
  }

  async function askAndInterrupt(
    handle: (request: Request) => Promise<Response>,
    how: Interruption,
  ) {
    if (how !== 'the visitor leaving') {
      await allEventsOf(await handle(question(MODEL_QUESTION)));
      return;
    }
    const leaving = new AbortController();
    const responsesBefore = openAIResponses;
    const asked = question(MODEL_QUESTION, { signal: leaving.signal });
    const answer = allEventsOf(await handle(asked));
    await vi.waitFor(() => {
      expect(openAIResponses).toBe(responsesBefore + 1);
    });
    leaving.abort();
    await answer.catch(() => undefined);
    // Held until the abort reached it: undici stops forwarding the abort to a collected Request.
    expect(asked.signal.aborted).toBe(true);
  }

  /** Runs one interrupted answer through a fresh container and waits until its cost is recorded. */
  async function interruptedAnswer(kind: RoundKind, how: Interruption, dailyModelTokens?: number) {
    const handle = postChat({
      ...(dailyModelTokens === undefined ? {} : { dailyModelTokens }),
      ...(how === 'the visitor leaving' ? { openAITimeoutMs: PATIENT_TIMEOUT_MS } : {}),
    });
    const bodies = interruptedCompletions(kind, how);
    const estimatesBefore = loggedEvents('model.usage_estimated').length;
    await askAndInterrupt(handle, how);
    await vi.waitFor(() => {
      expect(loggedEvents('model.usage_estimated')).toHaveLength(estimatesBefore + 1);
    });
    return { handle, body: bodies.join('') };
  }

  async function nextModelAnswerIsPaced(handle: (request: Request) => Promise<Response>) {
    const calls = outbound.filter((request) => request.url === COMPLETIONS).length;
    await allEventsOf(await handle(question('Compare Way2b1 and Deel.')));
    const paced = loggedEvents('chat.answered').at(-1)?.outcome === 'paced';
    const calledOpenAI = outbound.filter((request) => request.url === COMPLETIONS).length > calls;
    expect(paced).toBe(!calledOpenAI);
    return paced;
  }

  const CASES = (Object.keys(ROUNDS) as RoundKind[]).flatMap((kind) =>
    INTERRUPTIONS.map((how) => [kind, how] as const),
  );

  it.each(CASES)(
    'a round streaming %s, cut short by %s, still spends at least what it exchanged',
    async (kind, how) => {
      const measured = await interruptedAnswer(kind, how);
      const exchanged = measured.body.length + ROUNDS[kind].receivedChars;
      const atLeast = Math.ceil(exchanged / 3);

      const { handle, body } = await interruptedAnswer(kind, how, atLeast);

      expect(body).toBe(measured.body);
      expect(await nextModelAnswerIsPaced(handle)).toBe(true);
      expect(loggedEvents('model.usage_estimated').at(-1)).toMatchObject({
        outputTokens: MAX_OUTPUT_TOKENS,
      });
    },
  );

  it('charges nothing for a call OpenAI refused', async () => {
    const handle = postChat({ dailyModelTokens: 1 });
    server.use(
      http.post(COMPLETIONS, () =>
        HttpResponse.json(
          { error: { message: 'stubbed failure', type: 'invalid_request_error' } },
          { status: 400 },
        ),
      ),
    );

    await allEventsOf(await handle(question(MODEL_QUESTION)));

    expect(loggedEvents('model.usage_estimated')).toEqual([]);
    expect(await nextModelAnswerIsPaced(handle)).toBe(false);
  });

  it('counts reported usage exactly once', async () => {
    const reportedTotal = USAGE.usage.prompt_tokens + USAGE.usage.completion_tokens;

    const exhausted = postChat({ dailyModelTokens: reportedTotal });
    scriptedCompletions(textRound(...DELTAS));
    await allEventsOf(await exhausted(question(MODEL_QUESTION)));
    expect(await nextModelAnswerIsPaced(exhausted)).toBe(true);

    const oneTokenLeft = postChat({ dailyModelTokens: reportedTotal + 1 });
    scriptedCompletions(textRound(...DELTAS), textRound('He paired with them weekly.'));
    await allEventsOf(await oneTokenLeft(question(MODEL_QUESTION)));
    expect(await nextModelAnswerIsPaced(oneTokenLeft)).toBe(false);
    expect(loggedEvents('model.usage_estimated')).toEqual([]);
  });
});
