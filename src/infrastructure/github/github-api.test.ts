import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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

const USER = {
  login: 'marcio-w-alves',
  name: 'Marcio Montenegro',
  bio: 'Frontend engineer',
  public_repos: 12,
  followers: 3,
  html_url: 'https://github.com/marcio-w-alves',
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
    html_url: `https://github.com/marcio-w-alves/${name}`,
    pushed_at: '2026-10-28T00:00:00Z',
  };
}

describe('GitHub API adapter', () => {
  it('reads the public profile of the configured account', async () => {
    server.use(
      http.get('https://api.github.com/users/marcio-w-alves', () => HttpResponse.json(USER)),
    );
    expect(await createGithubApi({ username: 'marcio-w-alves' }).profile()).toEqual({
      login: 'marcio-w-alves',
      name: 'Marcio Montenegro',
      bio: 'Frontend engineer',
      publicRepositories: 12,
      followers: 3,
      url: 'https://github.com/marcio-w-alves',
      createdAt: '2017-08-15T00:00:00Z',
    });
  });

  it('lists repositories most recently pushed first, trimmed to the limit', async () => {
    let query = '';
    server.use(
      http.get('https://api.github.com/users/marcio-w-alves/repos', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json([repository('a'), repository('b'), repository('c')]);
      }),
    );
    const repositories = await createGithubApi({ username: 'marcio-w-alves' }).repositories(2);
    expect(repositories?.map((repo) => repo.name)).toEqual(['a', 'b']);
    expect(query).toContain('sort=pushed');
  });

  it('authenticates only when a token is configured', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('https://api.github.com/users/marcio-w-alves', ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json(USER);
      }),
    );
    await createGithubApi({ username: 'marcio-w-alves' }).profile();
    await createGithubApi({ username: 'marcio-w-alves', token: 'ghp_test' }).profile();
    expect(seen).toEqual([null, 'Bearer ghp_test']);
  });

  it('reports GitHub as unavailable when it rate-limits or fails', async () => {
    server.use(
      http.get('https://api.github.com/users/marcio-w-alves', () =>
        HttpResponse.json({ message: 'API rate limit exceeded' }, { status: 403 }),
      ),
    );
    expect(await createGithubApi({ username: 'marcio-w-alves' }).profile()).toBeNull();
  });
});
