import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile';
import type { GithubPort, GithubProfile, GithubRepository } from '../ports/github.port';
import type { ReferencePort, ReferenceSummary } from '../ports/reference.port';
import { createResponseKit } from '../response-kit';
import { createExternalTools } from './external-tools';
import type { ToolResult } from './tool';

const kit = createResponseKit(localize(fixtureKnowledge, 'en'));

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
  const tool = createExternalTools({ kit, references, github }).find((t) => t.name === name);
  if (!tool) throw new Error(`No tool ${name}`);
  const outcome = await tool.run(args);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

describe('getTechnologyBrief', () => {
  it('explains the technology and where the owner used it, citing the article with its link', async () => {
    const { port } = referencesFrom({ 'Bazel (software)': article('Bazel (software)') });
    const result = await call('getTechnologyBrief', { technology: 'Bazel' }, port);
    expect(result.data).toMatchObject({
      technology: 'Bazel',
      reference: { title: 'Bazel (software)', summary: 'Bazel (software) explained.' },
      inHisRecord: { verdict: 'documented' },
    });
    expect(result.sources[0]).toEqual({
      id: 'wikipedia:Bazel (software)',
      label: 'Wikipedia · Bazel (software)',
      url: 'https://en.wikipedia.org/wiki/Bazel (software)',
    });
  });

  it('refuses a technology outside his record, so the site does not explain unrelated stacks', async () => {
    const tool = createExternalTools({
      kit,
      references: referencesFrom({}).port,
      github: UNREACHABLE_GITHUB,
    }).find((t) => t.name === 'getTechnologyBrief');
    expect((await tool?.run({ technology: 'Rust' }))?.ok).toBe(false);
  });

  it('keeps coursework labelled as coursework next to the explanation', async () => {
    const { port } = referencesFrom({ 'Terraform (software)': article('Terraform (software)') });
    const result = await call('getTechnologyBrief', { technology: 'Terraform' }, port);
    expect(result.data).toMatchObject({ inHisRecord: { verdict: 'coursework only' } });
  });

  it('does not look anything up for a subject that has no article', async () => {
    const { port, asked } = referencesFrom({});
    const result = await call('getTechnologyBrief', { technology: 'Nix' }, port);
    expect(asked).toEqual([]);
    expect(result.data).toMatchObject({ reference: 'no public reference is available right now' });
  });

  it('bounds third-party text before it reaches the model', async () => {
    const { port } = referencesFrom({
      'Go (programming language)': article('Go', 'x'.repeat(5000)),
    });
    const result = await call('getTechnologyBrief', { technology: 'Go' }, port);
    const { reference } = result.data as { reference: { summary: string } };
    expect(reference.summary.length).toBeLessThanOrEqual(1200);
  });

  it.each([
    ['keeps an extract of exactly the limit whole', 1200, 'x'.repeat(1200)],
    ['cuts one character over the limit, marking the cut', 1201, `${'x'.repeat(1199)}…`],
  ])('%s', async (_label, length, expected) => {
    const { port } = referencesFrom({
      'Go (programming language)': article('Go', 'x'.repeat(length)),
    });
    const result = await call('getTechnologyBrief', { technology: 'Go' }, port);
    expect(result.data).toMatchObject({ reference: { summary: expected } });
  });
});

describe('getCompanyBrief', () => {
  it('looks up the company article by its unambiguous title', async () => {
    const { port, asked } = referencesFrom({ 'Acme Corporation': article('Acme Corp.') });
    const result = await call('getCompanyBrief', { company: 'acme' }, port);
    expect(asked).toEqual(['Acme Corporation']);
    expect(result.data).toMatchObject({
      company: 'Acme',
      hisRole: { role: 'Principal Platform Engineer', period: '2022 — Present' },
    });
  });

  it('cites the article next to the resume, and bounds its text', async () => {
    const { port } = referencesFrom({
      'Acme Corporation': article('Acme Corp.', 'y'.repeat(3000)),
    });
    const result = await call('getCompanyBrief', { company: 'acme' }, port);
    const { reference } = result.data as { reference: { summary: string } };
    expect(reference.summary).toHaveLength(1200);
    expect(result.sources.map((source) => source.id)).toEqual(['wikipedia:Acme Corp.', 'cv.acme']);
  });

  it('refuses a company that is not one of his roles', async () => {
    const tool = createExternalTools({
      kit,
      references: referencesFrom({}).port,
      github: UNREACHABLE_GITHUB,
    }).find((t) => t.name === 'getCompanyBrief');
    expect((await tool?.run({ company: 'google' }))?.ok).toBe(false);
  });

  it('still describes his role at a company that has no article', async () => {
    const { port, asked } = referencesFrom({});
    const result = await call('getCompanyBrief', { company: 'globex' }, port);
    expect(asked).toEqual([]);
    expect(result.data).toMatchObject({
      reference: 'no public reference is available right now',
      hisRole: { role: 'Senior Platform Engineer' },
    });
  });
});

describe('getCityBrief', () => {
  it('describes the city he says he lives in from its encyclopedia article', async () => {
    const { port, asked } = referencesFrom({
      Porto: article('Porto', 'Porto is a city in northern Portugal.'),
    });
    const result = await call('getCityBrief', {}, port);
    expect(asked).toEqual(['Porto']);
    expect(result.data).toEqual({
      city: 'Porto',
      country: 'Portugal',
      reference: 'Porto is a city in northern Portugal.',
    });
  });
});

describe('GitHub and LinkedIn', () => {
  const PROFILE: GithubProfile = {
    login: 'ada-rivera-example',
    name: 'Ada Rivera',
    bio: 'b'.repeat(500),
    publicRepositories: 12,
    followers: 3,
    url: 'https://github.com/ada-rivera-example',
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
      url: `https://github.com/ada-rivera-example/${name}`,
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
      { id: 'github', label: 'GitHub profile', url: 'https://github.com/ada-rivera-example' },
    ]);
  });

  it('reports the GitHub profile as unavailable instead of inventing one', async () => {
    const result = await call('getGithubProfile', {}, referencesFrom({}).port);
    expect(result.data).toEqual({ available: false, url: 'https://github.com/ada-rivera-example' });
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
        kit,
        references: referencesFrom({}).port,
        github: LIVE_GITHUB,
      }).find((t) => t.name === 'getRepositories');
      expect((await tool?.run({ limit }))?.ok).toBe(false);
    },
  );

  it('reports GitHub as unavailable instead of inventing repositories', async () => {
    const result = await call('getRepositories', {}, referencesFrom({}).port);
    expect(result.data).toEqual({ available: false, url: 'https://github.com/ada-rivera-example' });
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
      url: 'https://www.linkedin.com/in/ada-rivera-example',
      note: expect.stringContaining('no public API') as unknown,
    });
  });
});
