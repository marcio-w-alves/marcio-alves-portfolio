import { describe, expect, it } from 'vitest';
import type { AssistantResponse, ConversationContext } from '../response';
import { toEvents } from '../response';
import { topics } from '../topics';
import { fastPath } from './fast-path';

const FRESH: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

function answer(question: string, context: ConversationContext = FRESH): AssistantResponse {
  const result = fastPath(question, context);
  if (result.kind !== 'answered') throw new Error(`Escalated instead of answering: ${question}`);
  return result.response;
}

function plainText(response: AssistantResponse): string {
  return response.parts
    .map((part) => (part.type === 'text' ? part.text : JSON.stringify(part.props)))
    .join('\n');
}

describe('fast path — the suggestion graph is closed', () => {
  it('answers every question the interface can suggest, however the visitor navigates', () => {
    const pending: string[] = topics.flatMap((topic) => [...topic.questions]);
    const visited = new Set<string>();
    while (pending.length > 0) {
      const question = pending.pop() ?? '';
      if (visited.has(question)) continue;
      visited.add(question);
      const result = fastPath(question, FRESH);
      expect(result.kind, `"${question}" was escalated`).toBe('answered');
      if (result.kind === 'answered') pending.push(...result.response.followUps);
    }
    expect(visited.size).toBeGreaterThan(40);
  });
});

describe('fast path — documented answers', () => {
  it('cites a source for every documented answer', () => {
    for (const question of topics.flatMap((topic) => [...topic.questions])) {
      const response = answer(question);
      if (response.grounded) expect(response.sources.length, question).toBeGreaterThan(0);
    }
  });

  it('closes a recruitment answer with the contact card only once per conversation', () => {
    const hasContact = (response: AssistantResponse) =>
      response.parts.some((part) => part.type === 'component' && part.component === 'contact');
    const question = 'What makes Marcio a strong Staff Engineer?';
    expect(hasContact(answer(question))).toBe(true);
    expect(hasContact(answer(question, { ...FRESH, ctaShown: true }))).toBe(false);
  });

  it('credits the Deel backlog reduction to the process the resume names', () => {
    expect(plainText(answer('How did he reduce the bug backlog at Deel?'))).toContain(
      'planned bug sprints',
    );
  });

  it('states the performance techniques the resume names instead of calling them undocumented', () => {
    const text = plainText(answer('How did he optimize performance?'));
    expect(text).toContain('targeted refactoring and optimization');
    expect(text).toContain('bundle size optimization');
  });

  it('lists the verbatim resume record when asked about a company', () => {
    expect(plainText(answer('What did he do at Shall And Partners?'))).toContain(
      'Promoted from Mid-level to Principal Frontend Developer',
    );
  });
});

describe('fast path — technologies', () => {
  it('reports professional evidence where the resume has it', () => {
    const response = answer('Has he worked with Kotlin?');
    expect(plainText(response)).toContain('Shall And Partners');
    expect(response.grounded).toBe(true);
  });

  it('keeps coursework apart from professional experience', () => {
    const response = answer('Does he know Angular?');
    expect(plainText(response)).toContain('only as coursework');
    expect(response.grounded).toBe(false);
  });

  it('says so plainly when a technology is not in the record', () => {
    const response = answer('Has he worked with GraphQL?');
    expect(plainText(response)).toContain("I don't have documented information");
    expect(response.grounded).toBe(false);
  });

  it('answers each technology in a question separately, without upgrading one into another', () => {
    const text = plainText(answer('Has he used Jest for testing?'));
    expect(text).toContain(
      "I don't have documented information about Marcio working with **Jest**",
    );
    expect(text).toContain('Frontend Testing Strategies');
  });
});

describe('fast path — boundaries', () => {
  it('refuses private questions without citing anything', () => {
    const response = answer("What's his salary?");
    expect(response.intent).toBe('privateInfo');
    expect(response.grounded).toBe(false);
    expect(response.sources).toEqual([]);
  });

  it('gives the country and declines to guess the city', () => {
    const text = plainText(answer('Where does he live?'));
    expect(text).toContain('Brazil');
    expect(text).toContain("isn't documented");
  });

  it('escalates instead of answering what it does not recognize', () => {
    expect(fastPath('What is TypeScript?', FRESH)).toEqual({ kind: 'escalate', nearest: 'react' });
  });
});

describe('toEvents', () => {
  it('streams every part in order, between a start and a finish', () => {
    const response = answer("Tell me about Marcio's career.");
    const events = toEvents(response);
    expect(events[0]).toEqual({ type: 'start', intent: 'career', related: 'deel' });
    expect(events.at(-1)).toEqual({
      type: 'finish',
      followUps: response.followUps,
      sources: response.sources,
    });
    expect(events.map((event) => event.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'text-end',
      'component',
      'text-start',
      'text-delta',
      'text-end',
      'component',
      'finish',
    ]);
  });

  it('carries the component name and resolved props, never a knowledge-base id', () => {
    const events = toEvents(answer("Tell me about Marcio's career."));
    const metrics = events.find(
      (event) => event.type === 'component' && event.component === 'metrics',
    );
    // The predicate above is inferred as a type guard, so this is the metrics event.
    const items = metrics?.props.items ?? [];
    expect(items[0]).toEqual({
      value: '50%',
      label: 'Reduction in critical page loading time',
      context: 'Deel',
    });
  });
});
