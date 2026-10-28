import robotsParser from 'robots-parser';
import { reasonOf } from './errors';

/** What one origin's robots.txt lets this crawler do. */
export interface RobotsPolicy {
  isAllowed(url: string): boolean;
  /** How long to wait between two requests to the origin, as robots.txt asks. */
  readonly crawlDelayMs: number;
}

export interface RobotsOptions {
  readonly fetch: typeof fetch;
  readonly userAgent: string;
  readonly timeoutMs: number;
}

const NO_ROBOTS_FILE: RobotsPolicy = { isAllowed: () => true, crawlDelayMs: 0 };

/**
 * Reads an origin's robots.txt. A missing file allows everything; any other
 * failure throws, because a policy that cannot be read is not permission.
 */
export async function readRobots(
  origin: string,
  { fetch, userAgent, timeoutMs }: RobotsOptions,
): Promise<RobotsPolicy> {
  const robotsUrl = new URL('/robots.txt', origin).href;
  const response = await fetch(robotsUrl, {
    headers: { 'user-agent': userAgent },
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((error: unknown) => {
    throw new Error(`${robotsUrl}: could not be read (${reasonOf(error)})`, { cause: error });
  });
  if (response.status === 404) return NO_ROBOTS_FILE;
  if (!response.ok) throw new Error(`${robotsUrl}: answered ${String(response.status)}`);
  const robots = robotsParser(robotsUrl, await response.text());
  return {
    isAllowed: (url) => robots.isAllowed(url, userAgent) === true,
    crawlDelayMs: (robots.getCrawlDelay(userAgent) ?? 0) * 1000,
  };
}
