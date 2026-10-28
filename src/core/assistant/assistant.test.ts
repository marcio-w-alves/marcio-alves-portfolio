import { describe, expect, it } from 'vitest';
import { createAssistant, type AnswerReport, type AssistantRequest } from './assistant';
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

/** Time moves only when a model answer is being given, 250 ms per event. */
let elapsedMs = 0;
const clock = { now: () => new Date(elapsedMs) };

const reported: unknown[] = [];
const answered: AnswerReport[] = [];
function assistantWith(
  model: ModelAssistant | null,
  { budget = budgetThat(true), answerCache = memoryCache() } = {},
) {
  reported.length = 0;
  answered.length = 0;
  return createAssistant({
    modelAssistant: model,
    budget,
    answerCache,
    clock,
    reportError: (error) => reported.push(error),
    onAnswered: (report) => answered.push(report),
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

describe('assistant — reporting how each question was handled', () => {
  it('reports a fast-path answer with its intent and who asked', async () => {
    await collect(assistantWith(sentenceModel().model), "Tell me about Marcio's career.");
    expect(answered).toEqual([
      { path: 'fast', outcome: 'answered', intent: 'career', clientId: 'visitor-1', durationMs: 0 },
    ]);
  });

  it('reports a model answer, timed from the question to the last event', async () => {
    const { model } = fakeModel(async function* (modelRequest) {
      for (const event of [
        { type: 'start', intent: 'model', related: null },
        { type: 'finish', followUps: modelRequest.followUps, sources: [] },
      ] as const) {
        elapsedMs += 250;
        yield event;
      }
    });
    await collect(assistantWith(model), 'Compare his leadership at Deel and Roots.');
    expect(answered).toEqual([
      {
        path: 'model',
        outcome: 'answered',
        intent: 'leadership',
        clientId: 'visitor-1',
        durationMs: 500,
      },
    ]);
  });

  it('tells a cached answer apart from one the model gave', async () => {
    const assistant = assistantWith(sentenceModel().model);
    await collect(assistant, 'What is TypeScript?');
    await collect(assistant, 'What is TypeScript?');
    expect(answered.map((report) => report.outcome)).toEqual(['answered', 'cached']);
  });

  it.each([
    ['no model is configured', null, true, 'unavailable'],
    ['the budget refuses', sentenceModel().model, false, 'paced'],
  ] as const)('reports why the model did not answer when %s', async (_, model, admits, outcome) => {
    await collect(assistantWith(model, { budget: budgetThat(admits) }), 'What is TypeScript?');
    expect(answered).toMatchObject([{ path: 'model', outcome }]);
  });

  it('tells a failure before any answer apart from an interruption part-way', async () => {
    const silent = fakeModel(async function* () {
      yield* [];
      throw new Error('provider down');
    });
    const partial = fakeModel(async function* () {
      yield { type: 'start', intent: 'model', related: null };
      throw new Error('connection reset');
    });
    await collect(assistantWith(silent.model), 'What is TypeScript?');
    const failed = answered[0]?.outcome;
    await collect(assistantWith(partial.model), 'What is TypeScript?');
    expect([failed, answered[0]?.outcome]).toEqual(['failed', 'interrupted']);
  });

  it('never puts the question in the report', async () => {
    await collect(assistantWith(sentenceModel().model), 'Is my secret plan any good?');
    expect(JSON.stringify(answered)).not.toMatch(/secret plan/i);
  });
});
