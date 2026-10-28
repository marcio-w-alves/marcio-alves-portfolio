import { describe, expect, it } from 'vitest';
import { createAssistant, type AssistantRequest } from './assistant';
import type { AssistantEvent } from './assistant-event';
import type { ModelAssistant, ModelAssistantRequest } from './system2/model-assistant';

const FRESH = { topic: 'overview', lastIntent: null, ctaShown: false };

function request(question: string): AssistantRequest {
  return { question, history: [], context: FRESH };
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
): Promise<AssistantEvent[]> {
  const events: AssistantEvent[] = [];
  for await (const event of assistant.answer(request(question))) events.push(event);
  return events;
}

const reported: unknown[] = [];
function assistantWith(model: ModelAssistant | null) {
  reported.length = 0;
  return createAssistant({ modelAssistant: model, reportError: (error) => reported.push(error) });
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
