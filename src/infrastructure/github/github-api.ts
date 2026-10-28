import type {
  GithubPort,
  GithubProfile,
  GithubRepository,
} from '@/core/assistant/ports/github.port';
import { cacheSuccesses } from '../http/ttl-cache';

const API = 'https://api.github.com';
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Fetched once and trimmed per call, so every limit shares one cached request. */
const PAGE_SIZE = 30;

interface UserPayload {
  readonly login: string;
  readonly name: string | null;
  readonly bio: string | null;
  readonly public_repos: number;
  readonly followers: number;
  readonly html_url: string;
  readonly created_at: string;
}

interface RepositoryPayload {
  readonly name: string;
  readonly description: string | null;
  readonly language: string | null;
  readonly stargazers_count: number;
  readonly fork: boolean;
  readonly topics?: readonly string[];
  readonly html_url: string;
  readonly pushed_at: string;
}

interface Options {
  readonly username: string;
  /** Optional: raises the rate limit from 60 to 5,000 requests an hour. */
  readonly token?: string;
  readonly timeoutMs?: number;
}

export function createGithubApi({ username, token, timeoutMs = TIMEOUT_MS }: Options): GithubPort {
  async function get<Payload>(path: string): Promise<Payload | null> {
    try {
      const response = await fetch(API + path, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'MarcioAlvesPortfolio',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return response.ok ? ((await response.json()) as Payload) : null;
    } catch {
      return null;
    }
  }

  const user = encodeURIComponent(username);
  const loadProfile = cacheSuccesses(CACHE_TTL_MS, () => get<UserPayload>(`/users/${user}`));
  const loadRepositories = cacheSuccesses(CACHE_TTL_MS, () =>
    get<RepositoryPayload[]>(`/users/${user}/repos?sort=pushed&per_page=${String(PAGE_SIZE)}`),
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
