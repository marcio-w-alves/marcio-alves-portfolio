/**
 * Reads the public sites on the profile's allow-list into the committed
 * snapshot the assistant retrieves from.
 *
 * Runs locally, by hand, never during a build or a request: review the diff,
 * then `pnpm rag:build` to embed it, and commit both.
 *
 *   pnpm sites:ingest           read the sites and rewrite the snapshot
 *   pnpm sites:ingest --check   list the pages read more than 180 days ago
 */
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import type { SitePassage } from '../src/core/knowledge/schema';
import { identity } from '../src/profile/identity';
import { siteAllowList } from '../src/profile/sites/allow-list';
import { ingestSites } from './ingest/ingest';
import { stalePages, STALE_AFTER_DAYS } from './ingest/staleness';

const SNAPSHOT = new URL('../src/profile/sites/snapshot.json', import.meta.url);

async function check(): Promise<void> {
  const { entries } = JSON.parse(await readFile(SNAPSHOT, 'utf8')) as {
    entries: SitePassage[];
  };
  const stale = stalePages(entries, new Date());
  if (stale.length === 0) {
    console.log(`Every page was read within the last ${String(STALE_AFTER_DAYS)} days.`);
    return;
  }
  console.log(`Read more than ${String(STALE_AFTER_DAYS)} days ago; run pnpm sites:ingest:`);
  for (const { url, fetchedAt } of stale) console.log(`  ${fetchedAt}  ${url}`);
}

async function ingest(): Promise<void> {
  const { snapshot, report } = await ingestSites(siteAllowList, {
    fetch,
    userAgent: `${identity.userAgentProduct}-ingest/1.0 (+https://${identity.siteHost})`,
    wait: (ms) => sleep(ms),
    now: new Date(),
    fallbackLanguage: 'en',
  });
  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 1)}\n`);
  for (const { url, passages } of report.ingested) {
    console.log(`  ${String(passages).padStart(3)} passages  ${url}`);
  }
  for (const { url, reason } of report.skipped) console.error(`  skipped  ${url}\n    ${reason}`);
  console.log(`Wrote ${String(snapshot.entries.length)} passages → ${SNAPSHOT.pathname}`);
  if (report.skipped.length > 0) {
    console.error(
      'Some pages were not read. Run again, or take them off the allow-list: the tests fail while an allow-listed page has no passage.',
    );
    process.exitCode = 1;
  }
}

await (process.argv.includes('--check') ? check() : ingest());
