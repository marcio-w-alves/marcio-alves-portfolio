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
          'Reduced bug and support backlog tickets by two-thirds through implementing planned bug sprints.',
        ]) as unknown,
      }),
    ]);
    expect(result.sources).toEqual([{ id: 'resume.deel', label: 'Resume · Deel experience' }]);
  });

  it('returns only the metrics produced at the company asked about', async () => {
    const metrics = (await data('getAchievementMetrics', { company: 'roots' })) as { id: string }[];
    expect(metrics.map((metric) => metric.id)).toEqual([
      'roots-team',
      'roots-slack-bot',
      'roots-initial-load',
    ]);
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

  it('treats a name with regex metacharacters as text', async () => {
    expect(await data('getTechnologyEvidence', { technology: 'C++' })).toMatchObject({
      verdict: 'not documented',
    });
  });
});

describe('display actions', () => {
  it('resolves metric ids into cards on the server', async () => {
    const result = succeeded(await registry.run('showMetrics', { ids: ['deel-backlog'] }));
    expect(result.effect).toEqual({
      kind: 'display',
      component: {
        component: 'metrics',
        props: {
          items: [
            {
              value: '~67%',
              label: 'Of the bug and support backlog cleared through planned bug sprints',
              context: 'Deel',
            },
          ],
        },
      },
    });
  });

  it('cites the facts a card shows, since a card is an answer too', async () => {
    const metrics = succeeded(
      await registry.run('showMetrics', { ids: ['deel-backlog', 'roots-team'] }),
    );
    expect(metrics.sources.map((source) => source.id)).toEqual(['resume.deel', 'resume.roots']);
    const timeline = succeeded(await registry.run('showTimeline', { companies: ['toptal'] }));
    expect(timeline.sources.map((source) => source.id)).toEqual(['resume.toptal']);
  });

  it('refuses a metric the knowledge base does not have', async () => {
    expect((await registry.run('showMetrics', { ids: ['made-up-metric'] })).ok).toBe(false);
  });

  it('bounds how much a single card can show', async () => {
    const many = Array.from({ length: 9 }, () => 'deel-backlog');
    expect((await registry.run('showMetrics', { ids: many })).ok).toBe(false);
  });
});

describe('declineToAnswer', () => {
  it('records the reason so a refusal is never mistaken for a grounded answer', async () => {
    const result = succeeded(await registry.run('declineToAnswer', { reason: 'private' }));
    expect(result.effect).toEqual({ kind: 'decline', reason: 'private' });
    expect(result.sources).toEqual([]);
  });
});
