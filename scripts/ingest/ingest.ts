import type { SitePassage, SiteSubject } from '../../src/core/knowledge/schema';
import type { SiteEntry } from '../../src/profile/schema';
import { chunkPages } from './chunk';
import { PageError, reasonOf } from './errors';
import { extractReadablePage } from './extract';
import { fetchPage } from './fetch-page';
import { readRobots, type RobotsPolicy } from './robots';

export const MIN_REQUEST_GAP_MS = 1000;
export const ROBOTS_TIMEOUT_MS = 10_000;
export const PAGE_TIMEOUT_MS = 15_000;
export const RETRY_DELAY_MS = 2000;

export interface IngestOptions {
  readonly fetch: typeof fetch;
  readonly userAgent: string;
  /** Waits between requests; a test passes one that records instead of sleeping. */
  readonly wait: (ms: number) => Promise<void>;
  readonly now: Date;
  /** The language of a page that does not declare one. */
  readonly fallbackLanguage: string;
  readonly timeouts?: { readonly robotsMs: number; readonly pageMs: number };
}

export interface SiteSnapshot {
  /** `YYYY-MM-DD`. */
  readonly generatedAt: string;
  readonly entries: readonly SitePassage[];
}

export interface IngestReport {
  readonly ingested: readonly { readonly url: string; readonly passages: number }[];
  readonly skipped: readonly { readonly url: string; readonly reason: string }[];
}

interface ReadPage {
  readonly subject: SiteSubject;
  readonly url: string;
  readonly language: string;
  readonly paragraphs: readonly string[];
}

/**
 * Reads the allow-listed pages into passages. Each origin's robots.txt is
 * read first and obeyed; requests to one host are spaced by its crawl delay,
 * and never closer than a second. A page that is refused, disallowed or
 * unreadable is skipped and reported, never filled in.
 */
export async function ingestSites(
  allowList: readonly SiteEntry[],
  options: IngestOptions,
): Promise<{ snapshot: SiteSnapshot; report: IngestReport }> {
  const pages: ReadPage[] = [];
  const skipped: { url: string; reason: string }[] = [];
  for (const [origin, entries] of byOrigin(allowList)) {
    let robots: RobotsPolicy;
    try {
      robots = await robotsOf(origin, options);
    } catch (error) {
      skipped.push(...entries.map(({ url }) => ({ url, reason: reasonOf(error) })));
      continue;
    }
    for (const { subject, url } of entries) {
      try {
        pages.push({ subject, url, ...(await readPage(url, robots, options)) });
      } catch (error) {
        if (!(error instanceof PageError)) throw error;
        skipped.push({ url, reason: error.message });
      }
    }
  }
  const entries = passagesOf(pages, today(options.now));
  return {
    snapshot: { generatedAt: today(options.now), entries },
    report: {
      ingested: pages.map(({ url }) => ({
        url,
        passages: entries.filter((entry) => entry.url === url).length,
      })),
      skipped,
    },
  };
}

function byOrigin(allowList: readonly SiteEntry[]) {
  const origins = new Map<string, { subject: SiteSubject; url: string }[]>();
  for (const { subject, urls } of allowList) {
    for (const url of urls) {
      const { origin } = new URL(url);
      origins.set(origin, [...(origins.get(origin) ?? []), { subject, url }]);
    }
  }
  return origins;
}

/** A policy that cannot be read forbids: the whole origin is skipped. */
async function robotsOf(origin: string, options: IngestOptions): Promise<RobotsPolicy> {
  try {
    return await readRobots(origin, {
      fetch: options.fetch,
      userAgent: options.userAgent,
      timeoutMs: options.timeouts?.robotsMs ?? ROBOTS_TIMEOUT_MS,
    });
  } catch (error) {
    throw new PageError(`robots.txt unavailable, so the site is not crawled: ${reasonOf(error)}`);
  }
}

async function readPage(url: string, robots: RobotsPolicy, options: IngestOptions) {
  if (!robots.isAllowed(url)) throw new PageError(`${url}: robots.txt disallows it`);
  await options.wait(Math.max(MIN_REQUEST_GAP_MS, robots.crawlDelayMs));
  const html = await fetchPage(url, {
    fetch: options.fetch,
    userAgent: options.userAgent,
    timeoutMs: options.timeouts?.pageMs ?? PAGE_TIMEOUT_MS,
    retryDelayMs: Math.max(RETRY_DELAY_MS, robots.crawlDelayMs),
    wait: options.wait,
    isAllowed: (target) => robots.isAllowed(target),
  });
  return extractReadablePage(html, url, options.fallbackLanguage);
}

/** Numbered per subject in allow-list order, so an unchanged site gives an unchanged snapshot. */
function passagesOf(pages: readonly ReadPage[], fetchedAt: string): SitePassage[] {
  const chunked = chunkPages(pages);
  const numbered = new Map<string, number>();
  return pages.flatMap(({ subject, url, language }, index) =>
    (chunked[index]?.passages ?? []).map((text): SitePassage => {
      const n = numbered.get(subject.id) ?? 0;
      numbered.set(subject.id, n + 1);
      return { id: `site/${subject.id}/${String(n)}`, subject, url, fetchedAt, language, text };
    }),
  );
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}
