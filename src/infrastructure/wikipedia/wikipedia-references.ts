import type { ReferencePort, ReferenceSummary } from '@/core/assistant/ports/reference.port';
import { cacheSuccesses } from '../http/ttl-cache';

const SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Wikimedia asks clients to identify themselves; a URL is enough contact.
export const USER_AGENT = 'MarcioAlvesPortfolio/1.0 (https://marciomariani.dev)';

interface SummaryPayload {
  readonly type?: string;
  readonly title?: string;
  readonly extract?: string;
  readonly content_urls?: { readonly desktop?: { readonly page?: string } };
}

async function fetchSummary(title: string, timeoutMs: number): Promise<ReferenceSummary | null> {
  try {
    const response = await fetch(
      SUMMARY_ENDPOINT + encodeURIComponent(title.replaceAll(' ', '_')),
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as SummaryPayload;
    // A disambiguation page lists meanings; it is not a description of anything.
    if (payload.type !== 'standard' || !payload.title || !payload.extract) return null;
    return {
      title: payload.title,
      extract: payload.extract,
      url:
        payload.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch {
    // Timeouts and network failures read as "unavailable", which the action
    // reports to the model explicitly rather than as missing knowledge.
    return null;
  }
}

export function createWikipediaReferences({ timeoutMs = TIMEOUT_MS } = {}): ReferencePort {
  return { summary: cacheSuccesses(CACHE_TTL_MS, (title) => fetchSummary(title, timeoutMs)) };
}
