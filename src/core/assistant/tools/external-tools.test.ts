import { describe, expect, it } from 'vitest';
import type { GithubPort } from '../ports/github.port';
import type { ReferencePort, ReferenceSummary } from '../ports/reference.port';
import { createExternalTools } from './external-tools';
import type { ToolResult } from './tool';

const UNREACHABLE_GITHUB: GithubPort = {
  profile: () => Promise.resolve(null),
  repositories: () => Promise.resolve(null),
};

function referencesFrom(articles: Record<string, ReferenceSummary>) {
  const asked: string[] = [];
  const port: ReferencePort = {
    summary: (title) => {
      asked.push(title);
      return Promise.resolve(articles[title] ?? null);
    },
  };
  return { port, asked };
}

function article(title: string, extract = `${title} explained.`): ReferenceSummary {
  return { title, extract, url: `https://en.wikipedia.org/wiki/${title}` };
}

async function call(
  name: string,
  args: unknown,
  references: ReferencePort,
  github: GithubPort = UNREACHABLE_GITHUB,
): Promise<ToolResult> {
  const tool = createExternalTools({ references, github }).find((t) => t.name === name);
  if (!tool) throw new Error(`No tool ${name}`);
  const outcome = await tool.run(args);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

describe('getTechnologyBrief', () => {
  it('explains the technology and where Marcio used it, citing the article with its link', async () => {
    const { port } = referencesFrom({ TypeScript: article('TypeScript') });
    const result = await call('getTechnologyBrief', { technology: 'TypeScript' }, port);
    expect(result.data).toMatchObject({
      technology: 'TypeScript',
      reference: { title: 'TypeScript', summary: 'TypeScript explained.' },
      marcio: { verdict: 'documented' },
    });
    expect(result.sources[0]).toEqual({
      id: 'wikipedia:TypeScript',
      label: 'Wikipedia · TypeScript',
      url: 'https://en.wikipedia.org/wiki/TypeScript',
    });
  });

  it('refuses a technology outside his record, so the site does not explain unrelated stacks', async () => {
    const tool = createExternalTools({
      references: referencesFrom({}).port,
      github: UNREACHABLE_GITHUB,
    }).find((t) => t.name === 'getTechnologyBrief');
    expect((await tool?.run({ technology: 'Rust' }))?.ok).toBe(false);
  });

  it('keeps coursework labelled as coursework next to the explanation', async () => {
    const { port } = referencesFrom({
      'Angular (web framework)': article('Angular (web framework)'),
    });
    const result = await call('getTechnologyBrief', { technology: 'Angular' }, port);
    expect(result.data).toMatchObject({ marcio: { verdict: 'coursework only' } });
  });

  it('does not look anything up for a subject that has no article', async () => {
    const { port, asked } = referencesFrom({});
    const result = await call('getTechnologyBrief', { technology: 'Core Web Vitals' }, port);
    expect(asked).toEqual([]);
    expect(result.data).toMatchObject({ reference: 'no public reference is available right now' });
  });

  it('bounds third-party text before it reaches the model', async () => {
    const { port } = referencesFrom({ Redis: article('Redis', 'x'.repeat(5000)) });
    const result = await call('getTechnologyBrief', { technology: 'Redis' }, port);
    const { reference } = result.data as { reference: { summary: string } };
    expect(reference.summary.length).toBeLessThanOrEqual(1200);
  });
});

describe('getCompanyBrief', () => {
  it('looks up the company article by its unambiguous title', async () => {
    const { port, asked } = referencesFrom({ 'Deel (company)': article('Deel, Inc.') });
    const result = await call('getCompanyBrief', { company: 'deel' }, port);
    expect(asked).toEqual(['Deel (company)']);
    expect(result.data).toMatchObject({
      company: 'Deel',
      marcioRole: { role: 'Senior Frontend Engineer', period: '2022 — 2026' },
    });
  });

  it('still describes his role at a company that has no article', async () => {
    const { port, asked } = referencesFrom({});
    const result = await call('getCompanyBrief', { company: 'roots' }, port);
    expect(asked).toEqual([]);
    expect(result.data).toMatchObject({
      reference: 'no public reference is available right now',
      marcioRole: { role: 'Lead Frontend Engineer' },
    });
  });
});

describe('getCityBrief', () => {
  it('says the city is not documented, without looking anything up', async () => {
    const { port, asked } = referencesFrom({});
    const result = await call('getCityBrief', {}, port);
    expect(asked).toEqual([]);
    expect(result.data).toEqual({
      country: 'Brazil',
      city: 'not documented',
      note: 'Do not guess or infer the city.',
    });
  });
});

describe('GitHub and LinkedIn', () => {
  it('reports GitHub as unavailable instead of inventing repositories', async () => {
    const result = await call('getRepositories', {}, referencesFrom({}).port);
    expect(result.data).toEqual({ available: false, url: 'https://github.com/marcio-w-alves' });
  });

  it('passes the requested number of repositories through, defaulting to six', async () => {
    const limits: number[] = [];
    const github: GithubPort = {
      profile: () => Promise.resolve(null),
      repositories: (limit) => {
        limits.push(limit);
        return Promise.resolve([]);
      },
    };
    await call('getRepositories', {}, referencesFrom({}).port, github);
    await call('getRepositories', { limit: 3 }, referencesFrom({}).port, github);
    expect(limits).toEqual([6, 3]);
  });

  it('is explicit that LinkedIn is linked, not read', async () => {
    const result = await call('getLinkedinProfile', {}, referencesFrom({}).port);
    expect(result.data).toMatchObject({
      url: 'https://www.linkedin.com/in/marcio-montenegro',
      note: expect.stringContaining('no public API') as unknown,
    });
  });
});
