import robotsParser from 'robots-parser';
import { PageError, reasonOf } from './errors';
import { readText, requestWithinOrigin } from './fetch-page';

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
  const text = await readRobotsFile(robotsUrl, { fetch, userAgent, timeoutMs }).catch(
    (error: unknown) => {
      throw new Error(`${robotsUrl}: could not be read (${reasonOf(error)})`, { cause: error });
    },
  );
  if (text === null) return NO_ROBOTS_FILE;
  const robots = robotsParser(robotsUrl, text);
  return {
    isAllowed: (url) => robots.isAllowed(url, userAgent) === true,
    crawlDelayMs: (robots.getCrawlDelay(userAgent) ?? 0) * 1000,
  };
}

/**
 * The file's text, fetched under the pages' own rules — the same size cap and
 * redirects within the origin — or null when there is none.
 */
async function readRobotsFile(robotsUrl: string, options: RobotsOptions): Promise<string | null> {
  const response = await requestWithinOrigin(
    robotsUrl,
    { ...options, isAllowed: () => true },
    'text/plain',
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new PageError(`answered ${String(response.status)}`);
  return readText(robotsUrl, response);
}
