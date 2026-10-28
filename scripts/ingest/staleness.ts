import type { SitePassage } from '../../src/core/knowledge/schema';

export const STALE_AFTER_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The pages read more than 180 days ago, oldest first: time to run `pnpm sites:ingest` again. */
export function stalePages(
  entries: readonly SitePassage[],
  now: Date,
): { readonly url: string; readonly fetchedAt: string }[] {
  const pages = new Map(entries.map(({ url, fetchedAt }) => [url, fetchedAt]));
  return [...pages]
    .filter(([, fetchedAt]) => daysSince(fetchedAt, now) > STALE_AFTER_DAYS)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([url, fetchedAt]) => ({ url, fetchedAt }));
}

function daysSince(date: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(date)) / DAY_MS);
}
