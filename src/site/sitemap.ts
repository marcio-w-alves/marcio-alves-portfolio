import type { MetadataRoute } from 'next';
import type { Locale } from '@/core/i18n/locale';
import { counterparts, pagePath, type SitePage } from './routes';

/** The pages each published language has, in the order the sitemap lists them. */
export type PagesByLocale = ReadonlyMap<Locale, readonly SitePage[]>;

function languagesHaving(page: SitePage, pages: PagesByLocale): Locale[] {
  return [...pages].filter(([, list]) => list.includes(page)).map(([locale]) => locale);
}

/** The same page in each language that has it, at the canonical origin. */
function languagesOf(page: SitePage, locales: readonly Locale[], siteUrl: URL) {
  return Object.fromEntries(
    Object.entries(counterparts(page, locales)).map(([locale, path]) => [
      locale,
      new URL(path, siteUrl).href,
    ]),
  );
}

/**
 * Every page in every published language; a page that more than one language
 * has lists itself in the others.
 */
// No lastModified: the pages have no edit date to report, and the build time
// would claim a change on every deployment.
export function sitemap(siteUrl: URL, pages: PagesByLocale): MetadataRoute.Sitemap {
  return [...pages].flatMap(([locale, list]) =>
    list.map((page) => {
      const locales = languagesHaving(page, pages);
      return {
        url: new URL(pagePath(locale, page), siteUrl).href,
        ...(locales.length > 1
          ? { alternates: { languages: languagesOf(page, locales, siteUrl) } }
          : {}),
      };
    }),
  );
}
