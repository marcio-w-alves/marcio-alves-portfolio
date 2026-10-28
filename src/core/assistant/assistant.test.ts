import { describe, expect, it } from 'vitest';
import { createAssistant, type AssistantRequest } from './assistant';
import type { AssistantEvent } from './assistant-event';
import type { AnswerCachePort } from './ports/answer-cache.port';
import type { ModelBudgetPort } from './ports/model-budget.port';
import type { ModelAssistant, ModelAssistantRequest } from './system2/model-assistant';

const FRESH = { topic: 'overview', lastIntent: null, ctaShown: false };

function request(question: string, history: AssistantRequest['history'] = []): AssistantRequest {
  return { question, history, context: FRESH, clientId: 'visitor-1' };
}

/** An in-memory cache and a budget that admits or refuses, recording what it was asked. */
function memoryCache(): AnswerCachePort & {
  readonly store: Map<string, readonly AssistantEvent[]>;
} {
  const store = new Map<string, readonly AssistantEvent[]>();
  return { store, get: (key) => store.get(key), set: (key, events) => store.set(key, events) };
}

function budgetThat(admits: boolean): ModelBudgetPort & { readonly admitted: string[] } {
  const admitted: string[] = [];
  return {
    admitted,
    admit: (clientId) => {
      admitted.push(clientId);
      return admits;
    },
    record: () => undefined,
  };
}

function fakeModel(script: (request: ModelAssistantRequest) => AsyncGenerator<AssistantEvent>) {
  const received: ModelAssistantRequest[] = [];
  const model: ModelAssistant = {
    answer: (modelRequest) => {
      received.push(modelRequest);
      return script(modelRequest);
    },
  };
  return { model, received };
}

async function collect(
  assistant: ReturnType<typeof createAssistant>,
  question: string,
  history: AssistantRequest['history'] = [],
): Promise<AssistantEvent[]> {
  return Array.fromAsync(assistant.answer(request(question, history)));
}

const reported: unknown[] = [];
function assistantWith(
  model: ModelAssistant | null,
  { budget = budgetThat(true), answerCache = memoryCache() } = {},
) {
  reported.length = 0;
  return createAssistant({
    modelAssistant: model,
    budget,
    answerCache,
    reportError: (error) => reported.push(error),
  });
}

/** A model whose every answer is one sentence, counting its calls. */
function sentenceModel(sentence = 'An answer.') {
  return fakeModel(async function* (modelRequest) {
    yield { type: 'start', intent: 'model', related: null };
    yield { type: 'text-start', id: 'p0' };
    yield { type: 'text-delta', id: 'p0', delta: sentence };
    yield { type: 'text-end', id: 'p0' };
    yield { type: 'finish', followUps: modelRequest.followUps, sources: [] };
  });
}

describe('assistant — choosing a path', () => {
  it('answers what the fast path recognizes without calling the model', async () => {
    const { model, received } = fakeModel(async function* () {
      yield { type: 'start', intent: 'model', related: null };
    });
    const events = await collect(assistantWith(model), "Tell me about Marcio's career.");
    expect(received).toHaveLength(0);
    expect(events[0]).toEqual({ type: 'start', intent: 'career', related: 'deel' });
  });

  it('hands everything else to the model, with follow-ups the fast path can answer', async () => {
    const { model, received } = fakeModel(async function* (modelRequest) {
      yield { type: 'start', intent: 'model', related: null };
      yield { type: 'finish', followUps: modelRequest.followUps, sources: [] };
    });
    await collect(assistantWith(model), 'Compare his leadership at Deel and Roots.');
    expect(received[0]?.question).toBe('Compare his leadership at Deel and Roots.');
    expect(received[0]?.followUps).toEqual([
      'Show me examples of architectural decisions.',
      'How did he grow the team at Roots?',
      'Would he fit a technical leadership position?',
    ]);
  });
});

describe('assistant — when the model is unavailable', () => {
  it('answers honestly without one, instead of failing', async () => {
    const events = await collect(assistantWith(null), 'What is TypeScript?');
    expect(events[0]).toEqual({ type: 'start', intent: 'unknown', related: null });
    expect(events.at(-1)).toMatchObject({ type: 'finish', sources: [] });
  });

  it('falls back cleanly when the model fails before saying anything, and reports the failure', async () => {
    const failure = new Error('provider down');
    const { model } = fakeModel(async function* () {
      yield* [];
      throw failure;
    });
    const events = await collect(assistantWith(model), 'What is TypeScript?');
    expect(events.map((event) => event.type)).not.toContain('error');
    expect(events[0]).toMatchObject({ type: 'start', intent: 'unknown' });
    expect(reported).toEqual([failure]);
  });

  it('reports an interruption mid-answer as retryable rather than restarting it', async () => {
    const { model } = fakeModel(async function* () {
      yield { type: 'start', intent: 'model', related: null };
      yield { type: 'text-start', id: 'p0' };
      throw new Error('connection reset');
    });
    const events = await collect(assistantWith(model), 'What is TypeScript?');
    expect(events.at(-1)).toEqual({
      type: 'error',
      error: {
        code: 'internal',
        message: 'The answer was interrupted. Please try again.',
        retryable: true,
      },
    });
    expect(events.filter((event) => event.type === 'start')).toHaveLength(1);
  });
});

describe('assistant — spending on the model', () => {
  it('replays a cached answer to the same question without calling the model or the budget', async () => {
    const { model, received } = sentenceModel();
    const budget = budgetThat(true);
    const assistant = assistantWith(model, { budget });
    const first = await collect(assistant, 'What is TypeScript?');
    const second = await collect(assistant, '  what is  typescript?  ');
    expect(second).toEqual(first);
    expect(received).toHaveLength(1);
    expect(budget.admitted).toHaveLength(1);
  });

  it('does not reuse an answer given in the middle of a conversation, where it depends on history', async () => {
    const { model, received } = sentenceModel();
    const answerCache = memoryCache();
    const assistant = assistantWith(model, { answerCache });
    const history = [{ role: 'user' as const, text: 'Who is he?' }];
    await collect(assistant, 'What is TypeScript?', history);
    await collect(assistant, 'What is TypeScript?', history);
    expect(received).toHaveLength(2);
    expect(answerCache.store.size).toBe(0);
  });

  it('never caches an answer that was interrupted', async () => {
    const { model } = fakeModel(async function* () {
      yield { type: 'start', intent: 'model', related: null };
      throw new Error('reset');
    });
    const answerCache = memoryCache();
    await collect(assistantWith(model, { answerCache }), 'What is TypeScript?');
    expect(answerCache.store.size).toBe(0);
  });

  it('answers a visitor over their limit for free, offering questions that still work', async () => {
    const { model, received } = sentenceModel();
    const events = await collect(
      assistantWith(model, { budget: budgetThat(false) }),
      'Compare his leadership at Deel and Roots.',
    );
    expect(received).toHaveLength(0);
    expect(events[0]).toEqual({ type: 'start', intent: 'rateLimited', related: null });
    expect(events.at(-1)).toMatchObject({
      type: 'finish',
      sources: [],
      followUps: [
        'Show me examples of architectural decisions.',
        'How did he grow the team at Roots?',
        'Would he fit a technical leadership position?',
      ],
    });
  });

  it('paces by the client asking', async () => {
    const budget = budgetThat(true);
    await collect(assistantWith(sentenceModel().model, { budget }), 'What is TypeScript?');
    expect(budget.admitted).toEqual(['visitor-1']);
  });
});
