import { expect, test, type Page, type Request } from '@playwright/test';
import { DEFAULT_LOCALE } from '@/core/i18n/locale';
import { pagePath } from '@/site/routes';
import { pagesIn, published, sitePagesIn } from './support/profile';

/**
 * Prefetching a link costs its route tree and one request per segment it
 * renders: three for any page of this site. More for one address means the
 * router is fetching it again, as it did without end for every English link
 * once a Portuguese page had been opened (POR-101).
 */
const PREFETCHES_PER_ADDRESS = 3;

/** The address a request prefetches for the router, or null for any other request. */
function prefetchedAddress(request: Request): string | null {
  return request.headers()['next-router-prefetch'] === '1' ? new URL(request.url()).pathname : null;
}

/** The prefetch requests the page makes, counted by address as they happen. */
function prefetchesByAddress(page: Page): Map<string, number> {
  const counts = new Map<string, number>();
  page.on('request', (request) => {
    const address = prefetchedAddress(request);
    if (address !== null) counts.set(address, (counts.get(address) ?? 0) + 1);
  });
  return counts;
}

function prefetchOf(page: Page, path: string) {
  return page.waitForRequest((request) => prefetchedAddress(request) === path);
}

/**
 * Whether the network goes quiet. A page that keeps fetching never does, so
 * the wait may time out: the counts then name the address that kept it busy.
 */
function goesQuiet(page: Page): Promise<boolean> {
  return page.waitForLoadState('networkidle', { timeout: 5_000 }).then(
    () => true,
    () => false,
  );
}

function overfetched(counts: Map<string, number>): [string, number][] {
  return [...counts].filter(([, count]) => count > PREFETCHES_PER_ADDRESS);
}

/**
 * Every page in each published language, waiting for the same page in another
 * language — the link the switcher offers — to be prefetched before counting.
 */
for (const locale of published) {
  const other = published.find((candidate) => candidate !== locale);
  if (!other) continue;
  for (const sitePage of sitePagesIn(locale)) {
    const path = pagePath(locale, sitePage);

    test(`${path} prefetches each page it links to once`, async ({ page }) => {
      const counts = prefetchesByAddress(page);
      const counterpartPrefetched = prefetchOf(page, pagePath(other, sitePage));

      await page.goto(path);
      await counterpartPrefetched;
      const quiet = await goesQuiet(page);

      expect(overfetched(counts)).toEqual([]);
      expect(quiet).toBe(true);
    });
  }
}

for (const locale of published.filter((candidate) => candidate !== DEFAULT_LOCALE)) {
  test(`after a page in ${locale}, the English pages prefetch each link once`, async ({ page }) => {
    const counts = prefetchesByAddress(page);
    await page.goto(pagePath(locale, 'overview'));
    const englishTopicPrefetched = prefetchOf(page, pagePath(DEFAULT_LOCALE, 'experience'));

    await page
      .getByRole('navigation', { name: pagesIn(locale).ui.shell.language })
      .getByRole('link', { name: pagesIn(DEFAULT_LOCALE).ui.language.name })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await englishTopicPrefetched;
    const quiet = await goesQuiet(page);

    expect(overfetched(counts)).toEqual([]);
    expect(quiet).toBe(true);
  });
}
