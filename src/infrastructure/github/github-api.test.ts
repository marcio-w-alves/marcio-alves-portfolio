import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { createGithubApi } from './github-api';

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const PROFILE_URL = 'https://api.github.com/users/ada-rivera-example';
const REPOS_URL = 'https://api.github.com/users/ada-rivera-example/repos';

/** The adapter, with what it logs kept as parsed lines. */
function github(options: { token?: string; timeoutMs?: number } = {}) {
  const logged: Record<string, unknown>[] = [];
  const logger = createLogger({
    write: (level, line) => logged.push({ ...(JSON.parse(line) as object), level }),
  });
  return {
    api: createGithubApi({
      username: 'ada-rivera-example',
      userAgent: 'AdaRiveraPortfolio',
      logger,
      ...options,
    }),
    logged,
  };
}

const USER = {
  login: 'ada-rivera-example',
  name: 'Ada Rivera',
  bio: 'Frontend engineer',
  public_repos: 12,
  followers: 3,
  html_url: 'https://github.com/ada-rivera-example',
  created_at: '2017-08-15T00:00:00Z',
};

function repository(name: string) {
  return {
    name,
    description: `${name} description`,
    language: 'TypeScript',
    stargazers_count: 2,
    fork: false,
    topics: ['nextjs'],
    html_url: `https://github.com/ada-rivera-example/${name}`,
    pushed_at: '2026-10-28T00:00:00Z',
  };
}

describe('GitHub API adapter', () => {
  it('reads the public profile of the configured account', async () => {
    server.use(
      http.get('https://api.github.com/users/ada-rivera-example', () => HttpResponse.json(USER)),
    );
    expect(await github().api.profile()).toEqual({
      login: 'ada-rivera-example',
      name: 'Ada Rivera',
      bio: 'Frontend engineer',
      publicRepositories: 12,
      followers: 3,
      url: 'https://github.com/ada-rivera-example',
      createdAt: '2017-08-15T00:00:00Z',
    });
  });

  it('lists repositories most recently pushed first, trimmed to the limit', async () => {
    let query = '';
    server.use(
      http.get('https://api.github.com/users/ada-rivera-example/repos', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([repository('a'), repository('b'), repository('c')]);
      }),
    );
    const repositories = await github().api.repositories(2);
    expect(repositories?.map((repo) => repo.name)).toEqual(['a', 'b']);
    expect(query).toContain('sort=pushed');
  });

  it('names the site in the User-Agent, as GitHub requires of every client', async () => {
    let userAgent: string | null = null;
    server.use(
      http.get(PROFILE_URL, ({ request }) => {
        userAgent = request.headers.get('user-agent');
        return HttpResponse.json(USER);
      }),
    );
    await github().api.profile();
    expect(userAgent).toBe('AdaRiveraPortfolio');
  });

  it('authenticates only when a token is configured', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('https://api.github.com/users/ada-rivera-example', ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json(USER);
      }),
    );
    await github().api.profile();
    await github({ token: 'ghp_test' }).api.profile();
    expect(seen).toEqual([null, 'Bearer ghp_test']);
  });

  it('reports GitHub as unavailable when it rate-limits or fails', async () => {
    server.use(
      http.get('https://api.github.com/users/ada-rivera-example', () =>
        HttpResponse.json({ message: 'API rate limit exceeded' }, { status: 403 }),
      ),
    );
    expect(await github().api.profile()).toBeNull();
  });

  it('reads a valid profile and ignores fields it does not use', async () => {
    server.use(
      http.get(PROFILE_URL, () =>
        HttpResponse.json({ ...USER, site_admin: false, plan: { name: 'pro' } }),
      ),
    );
    const { api, logged } = github();
    expect(await api.profile()).toMatchObject({ login: 'ada-rivera-example', followers: 3 });
    expect(logged).toEqual([]);
  });

  it.each([
    [
      'a 5xx',
      'profile',
      PROFILE_URL,
      () => HttpResponse.json({ message: 'Server Error' }, { status: 502 }),
      { cause: 'status', status: 502 },
    ],
    [
      'a profile of the wrong shape',
      'profile',
      PROFILE_URL,
      () => HttpResponse.json({ ...USER, followers: 'many' }),
      { cause: 'shape', status: 200 },
    ],
    [
      'a body that is not JSON',
      'profile',
      PROFILE_URL,
      () => new HttpResponse('<html>rate limited</html>', { status: 200 }),
      { cause: 'shape', status: 200 },
    ],
    [
      'a repository list that is not a list',
      'repositories',
      REPOS_URL,
      () => HttpResponse.json({ items: [] }),
      { cause: 'shape', status: 200 },
    ],
    [
      'a network error',
      'profile',
      PROFILE_URL,
      () => HttpResponse.error(),
      { cause: 'network', status: null },
    ],
  ])('degrades to unavailable on %s, logging why', async (_label, operation, url, reply, why) => {
    server.use(http.get(url, reply));
    const { api, logged } = github();

    const result = operation === 'profile' ? await api.profile() : await api.repositories(3);

    expect(result).toBeNull();
    expect(logged).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'adapter.degraded',
        adapter: 'github',
        operation,
        ...why,
      }),
    ]);
  });

  it('degrades to unavailable on a response that never comes, logging a timeout', async () => {
    server.use(
      http.get(PROFILE_URL, async () => {
        await delay('infinite');
        return HttpResponse.json(USER);
      }),
    );
    const { api, logged } = github({ timeoutMs: 50 });

    expect(await api.profile()).toBeNull();
    expect(logged).toEqual([
      expect.objectContaining({ event: 'adapter.degraded', cause: 'timeout', status: null }),
    ]);
  });

  it('logs nothing that identifies the request beyond the operation', async () => {
    server.use(http.get(PROFILE_URL, () => HttpResponse.json({}, { status: 500 })));
    const { api, logged } = github({ token: 'ghp_secret' });
    await api.profile();
    expect(Object.keys(logged[0] ?? {}).sort()).toEqual(
      ['adapter', 'cause', 'event', 'level', 'operation', 'status', 'time'].sort(),
    );
    expect(JSON.stringify(logged)).not.toContain('ghp_secret');
  });
});
