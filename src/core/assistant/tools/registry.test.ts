import { describe, expect, it } from 'vitest';
import { createToolRegistry } from './registry';
import { defineTool, type ToolOutcome, type ToolResult } from './tool';

const registry = createToolRegistry();

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
    expect(() => createToolRegistry([impostor])).toThrow('Two tools share a name.');
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

  it('says the city is not documented instead of supplying one', async () => {
    expect(await data('getProfileSummary')).toMatchObject({
      location: { country: 'Brazil', city: 'not documented' },
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
    ['GraphQL', 'not documented'],
    ['Rust', 'not documented'],
  ])('classifies %s as %s', async (technology, verdict) => {
    expect(await data('getTechnologyEvidence', { technology })).toMatchObject({ verdict });
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
