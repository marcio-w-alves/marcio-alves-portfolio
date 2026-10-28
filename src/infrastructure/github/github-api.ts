import { z } from 'zod';
import type {
  GithubPort,
  GithubProfile,
  GithubRepository,
} from '@/core/assistant/ports/github.port';
import { fetchJson } from '../http/fetch-json';
import { cacheSuccesses } from '../http/ttl-cache';
import type { Logger } from '../logging/logger';

const API = 'https://api.github.com';
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Fetched once and trimmed per call, so every limit shares one cached request. */
const PAGE_SIZE = 30;

const userSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  public_repos: z.number(),
  followers: z.number(),
  html_url: z.string(),
  created_at: z.string(),
});

const repositoriesSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string().nullable(),
    language: z.string().nullable(),
    stargazers_count: z.number(),
    fork: z.boolean(),
    topics: z.array(z.string()).optional(),
    html_url: z.string(),
    pushed_at: z.string(),
  }),
);

interface Options {
  readonly username: string;
  /** Optional: raises the rate limit from 60 to 5,000 requests an hour. */
  readonly token?: string;
  readonly timeoutMs?: number;
  readonly logger: Logger;
}

export function createGithubApi({
  username,
  token,
  timeoutMs = TIMEOUT_MS,
  logger,
}: Options): GithubPort {
  function get<T>(path: string, schema: z.ZodType<T>, operation: string): Promise<T | null> {
    return fetchJson(
      {
        url: API + path,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'MarcioAlvesPortfolio',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeoutMs,
        schema,
      },
      { logger, adapter: 'github', operation },
    );
  }

  const user = encodeURIComponent(username);
  const loadProfile = cacheSuccesses(CACHE_TTL_MS, () =>
    get(`/users/${user}`, userSchema, 'profile'),
  );
  const loadRepositories = cacheSuccesses(CACHE_TTL_MS, () =>
    get(
      `/users/${user}/repos?sort=pushed&per_page=${String(PAGE_SIZE)}`,
      repositoriesSchema,
      'repositories',
    ),
  );

  return {
    async profile(): Promise<GithubProfile | null> {
      const payload = await loadProfile('profile');
      return (
        payload && {
          login: payload.login,
          name: payload.name,
          bio: payload.bio,
          publicRepositories: payload.public_repos,
          followers: payload.followers,
          url: payload.html_url,
          createdAt: payload.created_at,
        }
      );
    },
    async repositories(limit): Promise<GithubRepository[] | null> {
      const payload = await loadRepositories('repositories');
      return (
        payload?.slice(0, limit).map((repository) => ({
          name: repository.name,
          description: repository.description,
          language: repository.language,
          stars: repository.stargazers_count,
          fork: repository.fork,
          topics: repository.topics ?? [],
          url: repository.html_url,
          pushedAt: repository.pushed_at,
        })) ?? null
      );
    },
  };
}
