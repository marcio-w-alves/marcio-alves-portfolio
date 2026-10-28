import { z } from 'zod';
import type { ReferencePort, ReferenceSummary } from '@/core/assistant/ports/reference.port';
import { fetchJson } from '../http/fetch-json';
import { cacheSuccesses } from '../http/ttl-cache';
import type { Logger } from '../logging/logger';

const SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Wikimedia asks clients to identify themselves; a URL is enough contact.
export function userAgent(product: string, siteUrl: URL): string {
  return `${product}/1.0 (${siteUrl.origin})`;
}

const summarySchema = z.object({
  type: z.string(),
  title: z.string(),
  extract: z.string(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }).optional() }).optional(),
});

async function fetchSummary(
  title: string,
  agent: string,
  { timeoutMs, logger }: { readonly timeoutMs: number; readonly logger: Logger },
): Promise<ReferenceSummary | null> {
  // A null reads as "unavailable", which the action reports to the model
  // explicitly rather than as missing knowledge.
  const payload = await fetchJson(
    {
      url: SUMMARY_ENDPOINT + encodeURIComponent(title.replaceAll(' ', '_')),
      headers: { 'User-Agent': agent, Accept: 'application/json' },
      timeoutMs,
      schema: summarySchema,
    },
    { logger, adapter: 'wikipedia', operation: 'summary' },
  );
  // A disambiguation page lists meanings; it is not a description of anything.
  if (payload?.type !== 'standard' || !payload.extract) return null;
  return {
    title: payload.title,
    extract: payload.extract,
    url:
      payload.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

interface WikipediaOptions {
  /** The name the site goes by in the User-Agent. */
  readonly product: string;
  /** The site making the requests, named in the User-Agent as its contact. */
  readonly siteUrl: URL;
  readonly timeoutMs?: number;
  readonly logger: Logger;
}

export function createWikipediaReferences({
  product,
  siteUrl,
  timeoutMs = TIMEOUT_MS,
  logger,
}: WikipediaOptions): ReferencePort {
  const agent = userAgent(product, siteUrl);
  return {
    summary: cacheSuccesses(CACHE_TTL_MS, (title) =>
      fetchSummary(title, agent, { timeoutMs, logger }),
    ),
  };
}
