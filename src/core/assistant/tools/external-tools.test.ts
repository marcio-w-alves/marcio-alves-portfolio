import { describe, expect, it } from 'vitest';
import type { GithubPort, GithubProfile, GithubRepository } from '../ports/github.port';
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

  it.each([
    ['keeps an extract of exactly the limit whole', 1200, 'x'.repeat(1200)],
    ['cuts one character over the limit, marking the cut', 1201, `${'x'.repeat(1199)}…`],
  ])('%s', async (_label, length, expected) => {
    const { port } = referencesFrom({ Redis: article('Redis', 'x'.repeat(length)) });
    const result = await call('getTechnologyBrief', { technology: 'Redis' }, port);
    expect(result.data).toMatchObject({ reference: { summary: expected } });
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

  it('cites the article next to the resume, and bounds its text', async () => {
    const { port } = referencesFrom({
      'Deel (company)': article('Deel, Inc.', 'y'.repeat(3000)),
    });
    const result = await call('getCompanyBrief', { company: 'deel' }, port);
    const { reference } = result.data as { reference: { summary: string } };
    expect(reference.summary).toHaveLength(1200);
    expect(result.sources.map((source) => source.id)).toEqual([
      'wikipedia:Deel, Inc.',
      'resume.deel',
    ]);
  });

  it('refuses a company that is not one of his roles', async () => {
    const tool = createExternalTools({
      references: referencesFrom({}).port,
      github: UNREACHABLE_GITHUB,
    }).find((t) => t.name === 'getCompanyBrief');
    expect((await tool?.run({ company: 'google' }))?.ok).toBe(false);
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
  const PROFILE: GithubProfile = {
    login: 'marcio-w-alves',
    name: 'Marcio Alves',
    bio: 'b'.repeat(500),
    publicRepositories: 12,
    followers: 3,
    url: 'https://github.com/marcio-w-alves',
    createdAt: '2014-01-01T00:00:00Z',
  };

  function repository(name: string, description: string | null): GithubRepository {
    return {
      name,
      description,
      language: 'TypeScript',
      stars: 1,
      fork: false,
      topics: [],
      url: `https://github.com/marcio-w-alves/${name}`,
      pushedAt: '2026-10-01T00:00:00Z',
    };
  }

  const LIVE_GITHUB: GithubPort = {
    profile: () => Promise.resolve(PROFILE),
    repositories: () =>
      Promise.resolve([repository('long', 'd'.repeat(500)), repository('bare', null)]),
  };

  it('reads the GitHub profile live, with its bio bounded, citing the profile', async () => {
    const result = await call('getGithubProfile', {}, referencesFrom({}).port, LIVE_GITHUB);
    expect(result.data).toEqual({ ...PROFILE, bio: `${'b'.repeat(199)}…` });
    expect(result.sources).toEqual([
      { id: 'github', label: 'GitHub profile', url: 'https://github.com/marcio-w-alves' },
    ]);
  });

  it('reports the GitHub profile as unavailable instead of inventing one', async () => {
    const result = await call('getGithubProfile', {}, referencesFrom({}).port);
    expect(result.data).toEqual({ available: false, url: 'https://github.com/marcio-w-alves' });
  });

  it('bounds repository descriptions and keeps a missing one missing', async () => {
    const result = await call('getRepositories', {}, referencesFrom({}).port, LIVE_GITHUB);
    expect(result.data).toMatchObject([
      { name: 'long', description: `${'d'.repeat(199)}…` },
      { name: 'bare', description: null },
    ]);
  });

  it.each([[0], [11], [2.5], ['3']])(
    'refuses %j repositories, so the model cannot ask for an unbounded list',
    async (limit) => {
      const tool = createExternalTools({
        references: referencesFrom({}).port,
        github: LIVE_GITHUB,
      }).find((t) => t.name === 'getRepositories');
      expect((await tool?.run({ limit }))?.ok).toBe(false);
    },
  );

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
