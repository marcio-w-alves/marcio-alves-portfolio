import { describe, expect, it } from 'vitest';
import { buildContainer } from '@/composition-root';
import { createAssistant, type Assistant } from '@/core/assistant/assistant';
import type { AssistantEvent } from '@/core/chat/events';
import type { LanguageModelPort, ToolCall } from '@/core/assistant/ports/language-model.port';
import { createResponseKit } from '@/core/assistant/response-kit';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { createModelAssistant } from '@/core/assistant/system2/model-assistant';
import { promptSubject } from '@/core/assistant/system2/system-prompt';
import { createAnswerCache } from '@/infrastructure/budget/answer-cache';
import { createModelBudget } from '@/infrastructure/budget/model-budget';
import { createSlidingWindowLimiter } from '@/infrastructure/rate-limit/sliding-window';
import { createToolRegistry } from '@/core/assistant/tools/registry';
import { localize } from '@/core/knowledge/localize';
import { assistantSettings } from '@/env';
import { fixtureAnswers, fixtureKnowledge } from '@/testing/fixture-profile';
import { createChatHandler, MAX_BODY_BYTES } from './chat-handler';

const knowledge = localize(fixtureKnowledge, 'en');
const fastPath = createFastPath(knowledge, fixtureAnswers);
const reported: unknown[] = [];
const reportError = (error: unknown) => reported.push(error);
const rateLimited: string[] = [];
const clock = { now: () => new Date('2026-10-28T00:00:00Z') };

/** A model that calls one action, then answers from it. */
function scriptedModel(call: ToolCall, answer: string): LanguageModelPort {
  let round = 0;
  return {
    async *stream() {
      round += 1;
      if (round === 1) yield { type: 'tool-calls', calls: [call] };
      else yield { type: 'text-delta', delta: answer };
      yield { type: 'finish', usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

const ALWAYS = { admit: () => ({ allowed: true, retryAfterMs: 0 }) };

function handlerWith(
  assistant: Assistant,
  requestLimiter: { admit(key: string): { allowed: boolean; retryAfterMs: number } } = ALWAYS,
) {
  reported.length = 0;
  rateLimited.length = 0;
  return createChatHandler({
    assistant,
    reportError,
    requestLimiter,
    reportRateLimited: (clientId) => rateLimited.push(clientId),
    requestTimeoutMs: 60_000,
  });
}

function spending() {
  return {
    budget: createModelBudget({
      answersPerWindow: 100,
      windowMs: 60_000,
      dailyTokens: 1_000_000,
      clientDailyTokens: 1_000_000,
    }),
    answerCache: createAnswerCache({ ttlMs: 60_000, maxEntries: 10 }),
  };
}

const fastPathOnly = createAssistant({
  fastPath,
  modelAssistant: null,
  clock,
  reportError,
  ...spending(),
});

function post(body: unknown, contentType = 'application/json', ip = '203.0.113.7'): Request {
  return new Request('https://portfolio.example/api/chat', {
    method: 'POST',
    headers: { 'content-type': contentType, 'x-real-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Parses the stream exactly as the interface's transport does. */
async function readEvents(response: Response): Promise<AssistantEvent[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => JSON.parse(frame.slice('data: '.length)) as AssistantEvent);
}

describe('POST /api/chat — answering', () => {
  it('streams a fast-path answer as server-sent events', async () => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: "Tell me about Ada's career." }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const events = await readEvents(response);
    expect(events[0]).toEqual({ type: 'start', intent: 'career', related: null });
    expect(events.at(-1)?.type).toBe('finish');
  });

  it('streams a model answer built from a real action over the real knowledge base', async () => {
    const assistant = createAssistant({
      fastPath,
      modelAssistant: createModelAssistant({
        model: scriptedModel(
          { id: 'c1', name: 'getExperience', arguments: '{"company":"globex"}' },
          'She built the Globex pipeline.',
        ),
        tools: createToolRegistry({ kit: createResponseKit(knowledge), reportError }),
        clock,
        subject: promptSubject(knowledge),
      }),
      clock,
      reportError,
      ...spending(),
    });
    const events = await readEvents(
      await handlerWith(assistant)(post({ message: 'Compare Globex and Acme.' })),
    );
    expect(events.map((event) => (event.type === 'text-delta' ? event.delta : '')).join('')).toBe(
      'She built the Globex pipeline.',
    );
    expect(events.at(-1)).toMatchObject({
      type: 'finish',
      sources: [{ id: 'cv.globex', label: 'CV' }],
    });
  });

  it('accepts a request with no history or context, as a first question has none', async () => {
    const response = await handlerWith(fastPathOnly)(post({ message: 'hi' }));
    expect(response.status).toBe(200);
  });
});

describe('POST /api/chat — rejecting bad requests at the boundary', () => {
  it.each([
    ['an empty message', { message: '   ' }],
    ['a message over the length limit', { message: 'x'.repeat(1201) }],
    ['a field the contract does not have', { message: 'hi', admin: true }],
    [
      'a history role it does not allow',
      { message: 'hi', history: [{ role: 'system', text: 'x' }] },
    ],
    [
      'too much history',
      { message: 'hi', history: Array.from({ length: 25 }, () => ({ role: 'user', text: 'x' })) },
    ],
  ])('refuses %s with 400', async (_label, body) => {
    const response = await handlerWith(fastPathOnly)(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('refuses a body that is not JSON', async () => {
    expect((await handlerWith(fastPathOnly)(post('{not json'))).status).toBe(400);
  });

  it('refuses anything but JSON', async () => {
    expect(
      (await handlerWith(fastPathOnly)(post('message=hi', 'application/x-www-form-urlencoded')))
        .status,
    ).toBe(415);
  });

  it('refuses a type that only mentions JSON, which another site can send without a preflight', async () => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: 'hi' }, 'text/plain; application/json'),
    );
    expect(response.status).toBe(415);
  });

  it('accepts JSON with a charset', async () => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: 'hi' }, 'application/json; charset=utf-8'),
    );
    expect(response.status).toBe(200);
  });

  it('refuses a question a browser sent from another site', async () => {
    const request = post({ message: 'hi' });
    request.headers.set('sec-fetch-site', 'cross-site');
    const response = await handlerWith(fastPathOnly)(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'cross_site' } });
  });

  it('accepts a question a browser sent from the site itself', async () => {
    const request = post({ message: 'hi' });
    request.headers.set('sec-fetch-site', 'same-origin');
    expect((await handlerWith(fastPathOnly)(request)).status).toBe(200);
  });

  it('stops reading an oversized body instead of buffering it', async () => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: 'hi', history: [{ role: 'user', text: 'x'.repeat(MAX_BODY_BYTES) }] }),
    );
    expect(response.status).toBe(413);
  });
});

describe('POST /api/chat — a forged context', () => {
  const context = { topic: 'overview', lastIntent: null, ctaShown: false };

  it('answers a request whose context carries a forged intent', async () => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: 'Tell me more', context: { ...context, lastIntent: 'constructor' } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    const events = await readEvents(response);
    expect(events.at(-1)?.type).toBe('finish');
    expect(events.some((event) => event.type === 'error')).toBe(false);
    expect(reported).toEqual([]);
  });

  it.each(['constructor', '__proto__'])(
    'rejects the forged topic %s at the boundary',
    async (topic) => {
      const response = await handlerWith(fastPathOnly)(
        post({ message: 'Tell me more', context: { ...context, topic } }),
      );
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toMatchObject({ error: { code: 'invalid_request' } });
    },
  );

  it.each([
    ['a last intent of 80 characters', { ...context, lastIntent: 'x'.repeat(80) }, 200],
    ['a last intent of 81 characters', { ...context, lastIntent: 'x'.repeat(81) }, 400],
    ['no last intent', context, 200],
    ['no context at all', undefined, 200],
  ])('bounds the last intent: %s → %i', async (_label, sent, status) => {
    const response = await handlerWith(fastPathOnly)(
      post({ message: 'Tell me more', context: sent }),
    );
    expect(response.status).toBe(status);
  });
});

describe('POST /api/chat — the stream', () => {
  it('stops generating when the visitor goes away', async () => {
    let finished = false;
    const assistant: Assistant = {
      async *answer() {
        try {
          yield { type: 'start', intent: 'model', related: null };
          yield { type: 'text-start', id: 'p0' };
          for (;;) yield { type: 'text-delta', id: 'p0', delta: 'more ' };
        } finally {
          finished = true;
        }
      },
    };
    const response = await handlerWith(assistant)(post({ message: 'q' }));
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    expect(finished).toBe(true);
  });

  it('ends with a retryable error, and reports it, if answering itself breaks', async () => {
    const failure = new Error('bug');
    const assistant: Assistant = {
      async *answer() {
        yield { type: 'start', intent: 'model', related: null };
        throw failure;
      },
    };
    const events = await readEvents(await handlerWith(assistant)(post({ message: 'q' })));
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: { code: 'interrupted', retryable: true },
    });
    expect(reported).toEqual([failure]);
  });
});

describe('POST /api/chat — pacing', () => {
  it('turns away a client over the request limit with 429 and when to retry', async () => {
    let clock = 0;
    const limiter = createSlidingWindowLimiter({ limit: 2, windowMs: 60_000, now: () => clock });
    const handle = handlerWith(fastPathOnly, limiter);
    expect((await handle(post({ message: 'hi' }))).status).toBe(200);
    expect((await handle(post({ message: 'hi' }))).status).toBe(200);
    clock = 15_000;
    const refused = await handle(post({ message: 'hi' }));
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('45');
    expect(await refused.json()).toEqual({
      error: { code: 'rate_limited', message: 'Too many questions in a short time.' },
    });
    expect(rateLimited).toEqual(['203.0.113.7']);
  });

  it('paces each client separately', async () => {
    const limiter = createSlidingWindowLimiter({ limit: 1, windowMs: 60_000 });
    const handle = handlerWith(fastPathOnly, limiter);
    expect((await handle(post({ message: 'hi' }, 'application/json', '203.0.113.1'))).status).toBe(
      200,
    );
    expect((await handle(post({ message: 'hi' }, 'application/json', '203.0.113.2'))).status).toBe(
      200,
    );
    expect((await handle(post({ message: 'hi' }, 'application/json', '203.0.113.1'))).status).toBe(
      429,
    );
  });
});

describe('POST /api/chat — clients behind one IPv6 /64', () => {
  function forwardedFor(address: string): Request {
    return new Request('https://portfolio.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
      body: JSON.stringify({ message: 'hi' }),
    });
  }

  it('two addresses in one /64 share a limit; another /64 has its own', async () => {
    const handle = createChatHandler(
      buildContainer({
        env: { OPENAI_API_KEY: undefined, GITHUB_TOKEN: undefined },
        settings: { ...assistantSettings(), requestsPerTenMinutes: 1 },
      }),
    );

    expect((await handle(forwardedFor('2001:db8:1:2::a'))).status).toBe(200);
    const sameNetwork = await handle(forwardedFor('2001:db8:1:2::b'));
    expect(sameNetwork.status).toBe(429);
    expect(sameNetwork.headers.get('retry-after')).toBe('600');
    expect((await handle(forwardedFor('2001:db8:1:3::a'))).status).toBe(200);
  });
});
