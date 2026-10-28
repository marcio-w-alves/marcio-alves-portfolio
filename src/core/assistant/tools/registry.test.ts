import { describe, expect, it } from 'vitest';
import { createToolRegistry } from './registry';
import { defineTool, type ToolOutcome, type ToolResult } from './tool';

function rethrow(error: unknown): never {
  throw error;
}

const registry = createToolRegistry({ reportError: rethrow });

function succeeded(outcome: ToolOutcome): ToolResult {
  if (!outcome.ok) throw new Error(`Tool failed: ${outcome.error}`);
  return outcome.result;
}

async function data(name: string, args: unknown = {}): Promise<unknown> {
  return succeeded(await registry.run(name, args)).data;
}

describe('tool registry — the allow-list', () => {
  it('describes every action to the model as a plain object schema', () => {
    for (const tool of registry.tools) {
      expect(tool.parameters, tool.name).toMatchObject({ type: 'object' });
      expect(tool.parameters, tool.name).not.toHaveProperty('$schema');
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
    }
  });

  it('refuses an action that is not on the list, without running anything', async () => {
    expect(await registry.run('readDatabase', {})).toEqual({
      ok: false,
      error: 'Unknown action "readDatabase". Use only the listed actions.',
    });
  });

  it.each([
    [''],
    ['GetExperience'],
    [' getExperience'],
    ['getExperience()'],
    ['__proto__'],
    ['constructor'],
    ['toString'],
  ])('refuses the name %j, which is not exactly a listed action', async (name) => {
    expect(await registry.run(name, {})).toEqual({
      ok: false,
      error: `Unknown action "${name}". Use only the listed actions.`,
    });
  });

  it.each([
    ['no arguments at all', undefined],
    ['null', null],
    ['an array', []],
    ['a string', 'deel'],
    ['a number', 7],
    ['a company of the wrong type', { company: 1 }],
    ['an extra key next to a valid one', { company: 'deel', role: 'admin' }],
    ['a smuggled prototype', JSON.parse('{"__proto__": {"admin": true}}') as unknown],
  ])('rejects %s as arguments instead of running the action', async (_label, args) => {
    const outcome = await registry.run('getExperience', args);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.length).toBeGreaterThan(0);
  });

  it('rejects a company the knowledge base does not have, so the model cannot invent one', async () => {
    const outcome = await registry.run('getExperience', { company: 'google' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('company');
  });

  it('rejects arguments the action does not declare', async () => {
    expect((await registry.run('getProfileSummary', { includeSalary: true })).ok).toBe(false);
  });

  it('refuses to register two actions under one name', () => {
    const impostor = defineTool({
      name: 'getExperience',
      description: 'An action shadowing a real one.',
      input: {},
      execute: () => ({ data: null, sources: [] }),
    });
    expect(() => createToolRegistry({ extra: [impostor], reportError: rethrow })).toThrow(
      'Two tools share a name.',
    );
  });

  it('turns an action that throws into an error the model sees, reporting what it threw', async () => {
    const exploding = defineTool({
      name: 'getPortfolioStats',
      description: 'A stand-in action whose dependency throws when it runs.',
      input: {},
      execute: () => Promise.reject(new Error('db exploded')),
    });
    const reported: unknown[] = [];
    const withExploding = createToolRegistry({
      extra: [exploding],
      reportError: (error) => reported.push(error),
    });

    const outcome = await withExploding.run('getPortfolioStats', {});

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/^The action failed/);
    expect(JSON.stringify(outcome)).not.toContain('db exploded');
    expect(reported).toEqual([new Error('db exploded')]);
  });

  it('lets an action stopped by the visitor leaving end the answer, reporting nothing', async () => {
    const request = new AbortController();
    const waiting = defineTool({
      name: 'getPortfolioStats',
      description: 'A stand-in action that waits on the network until the request ends.',
      input: {},
      execute: (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(signal.reason as Error);
          });
        }),
    });
    const reported: unknown[] = [];
    const withWaiting = createToolRegistry({
      extra: [waiting],
      reportError: (error) => reported.push(error),
    });

    const running = withWaiting.run('getPortfolioStats', {}, request.signal);
    request.abort();

    await expect(running).rejects.toMatchObject({ name: 'AbortError' });
    expect(reported).toEqual([]);
  });

  it('hands the model only JSON', async () => {
    for (const tool of registry.tools) {
      const outcome = await tool.run({});
      if (outcome.ok) {
        expect(JSON.parse(JSON.stringify(outcome.result.data)), tool.name).toEqual(
          outcome.result.data,
        );
      }
    }
  });
});

describe('knowledge actions', () => {
  it("returns a role's resume statements verbatim, with its source", async () => {
    const result = succeeded(await registry.run('getExperience', { company: 'deel' }));
    expect(result.data).toEqual([
      expect.objectContaining({
        company: 'Deel',
        statements: expect.arrayContaining([
          'Reduced loading time on critical pages by 50% through targeted refactoring and optimization, decreasing People List page load time from six seconds to three seconds on cold run.',
        ]) as unknown,
      }),
    ]);
    expect(result.sources).toEqual([{ id: 'resume.deel', label: 'Resume' }]);
  });

  it('returns only the metrics produced at the company asked about', async () => {
    const metrics = (await data('getAchievementMetrics', { company: 'roots' })) as { id: string }[];
    expect(metrics.map((metric) => metric.id)).toEqual(['roots-team']);
  });

  it('gives the city he says he lives in', async () => {
    expect(await data('getProfileSummary')).toMatchObject({
      location: { country: 'Brazil', city: 'João Pessoa, Paraíba' },
    });
  });

  it('never exposes a phone number among the contact channels', async () => {
    const channels = JSON.stringify(await data('getContactChannels'));
    expect(channels).not.toMatch(/\d{4,}/);
    expect(channels).toContain('marcio.welben@gmail.com');
  });
});

describe('getTechnologyEvidence', () => {
  it.each([
    ['Kotlin', 'documented'],
    ['accessibility', 'documented'],
    ['automated testing', 'documented'],
    ['Angular', 'coursework only'],
    ['Redux', 'coursework only'],
    ['MongoDB', 'reported in his notes'],
    ['Elasticsearch', 'reported in his notes'],
    ['Rust', 'not documented'],
  ])('classifies %s as %s', async (technology, verdict) => {
    expect(await data('getTechnologyEvidence', { technology })).toMatchObject({ verdict });
  });

  it('hands over the note that reports a technology, with its tag, and cites the notes', async () => {
    const result = succeeded(
      await registry.run('getTechnologyEvidence', { technology: 'Cassandra' }),
    );
    expect(result.data).toMatchObject({ professionalWork: [], listedSkills: [] });
    const { reportedInNotes } = result.data as { reportedInNotes: string[] };
    expect(reportedInNotes.join('\n')).toMatch(/Cassandra[\s\S]*\[RELATO\]/);
    expect(result.sources).toEqual([{ id: 'notes', label: 'Knowledge base' }]);
  });

  it('reads the technology without the spaces around it', async () => {
    expect(await data('getTechnologyEvidence', { technology: '  Kotlin  ' })).toMatchObject({
      verdict: 'documented',
    });
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['longer than sixty characters', 'x'.repeat(61)],
  ])('refuses a technology name that is %s', async (_label, technology) => {
    expect((await registry.run('getTechnologyEvidence', { technology })).ok).toBe(false);
  });

  it('reports a name in another script as not documented rather than failing', async () => {
    expect(
      await data('getTechnologyEvidence', { technology: '日本語のフレームワーク' }),
    ).toMatchObject({
      verdict: 'not documented',
    });
  });

  it('treats a name with regex metacharacters as text', async () => {
    expect(await data('getTechnologyEvidence', { technology: 'C++' })).toMatchObject({
      verdict: 'not documented',
    });
  });
});

describe('display actions', () => {
  it('resolves metric ids into cards on the server', async () => {
    const result = succeeded(await registry.run('showMetrics', { ids: ['deel-people-list'] }));
    expect(result.effect).toEqual({
      kind: 'display',
      component: {
        component: 'metrics',
        props: {
          items: [
            {
              value: '6s → 3s',
              label: 'People List load time on a cold run',
              context: 'Deel',
            },
          ],
        },
      },
    });
  });

  it('cites the facts a card shows, since a card is an answer too', async () => {
    const metrics = succeeded(
      await registry.run('showMetrics', { ids: ['deel-people-list', 'roots-team'] }),
    );
    expect(metrics.sources.map((source) => source.id)).toEqual(['resume.deel', 'resume.roots']);
    const timeline = succeeded(await registry.run('showTimeline', { companies: ['toptal'] }));
    expect(timeline.sources.map((source) => source.id)).toEqual(['resume.toptal']);
  });

  it('refuses a metric the knowledge base does not have', async () => {
    expect((await registry.run('showMetrics', { ids: ['made-up-metric'] })).ok).toBe(false);
  });

  it.each([
    ['showMetrics', { ids: [] }],
    ['showTimeline', { companies: [] }],
    ['showTimeline', { companies: ['google'] }],
    ['showSkills', { areas: ['cooking'] }],
    ['showProjects', { projects: ['secret-project'] }],
    ['showContactCard', { phone: true }],
  ])('refuses %s with %j, so a card shows only real records', async (name, args) => {
    expect((await registry.run(name, args)).ok).toBe(false);
  });

  it('shows up to eight metrics on one card', async () => {
    const eight = Array.from({ length: 8 }, () => 'deel-people-list');
    expect((await registry.run('showMetrics', { ids: eight })).ok).toBe(true);
  });

  it('bounds how much a single card can show', async () => {
    const many = Array.from({ length: 9 }, () => 'deel-people-list');
    expect((await registry.run('showMetrics', { ids: many })).ok).toBe(false);
  });
});

describe('declineToAnswer', () => {
  it('records the reason so a refusal is never mistaken for a grounded answer', async () => {
    const result = succeeded(await registry.run('declineToAnswer', { reason: 'private' }));
    expect(result.effect).toEqual({ kind: 'decline', reason: 'private' });
    expect(result.sources).toEqual([]);
  });

  it.each([
    ['no reason', {}],
    ['a reason outside the list', { reason: 'too_hard' }],
  ])('refuses to record a decline with %s', async (_label, args) => {
    expect((await registry.run('declineToAnswer', args)).ok).toBe(false);
  });
});
