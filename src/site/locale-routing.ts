import { DEFAULT_LOCALE, LOCALE_SEGMENT, type Locale } from '../core/i18n/locale';

const ENGLISH = LOCALE_SEGMENT[DEFAULT_LOCALE];

/** Paths the pages never answer: the API and Next's own assets. */
const NOT_PAGES = ['api', '_next'];

/**
 * English has no prefix of its own, so an `/en` address is a second name for
 * a page. It answers 308 to the one the site writes; redirects only see the
 * incoming address, so the rewrite below is never redirected back.
 */
export function localeRedirects() {
  return [
    { source: `/${ENGLISH}`, destination: '/', permanent: true },
    { source: `/${ENGLISH}/:path*`, destination: '/:path*', permanent: true },
  ];
}

/**
 * Every page address without a published language's prefix is English, served
 * from the `en` segment. They run after the filesystem, so files in `public`
 * and routes outside `[locale]` (the sitemap, robots.txt, the icons) are
 * served as they are. A language that is not published keeps no prefix, so
 * its addresses fall through to the English not-found page.
 */
export function localeRewrites(published: readonly Locale[]) {
  const prefixed = published
    .filter((locale) => locale !== DEFAULT_LOCALE)
    .map((locale) => LOCALE_SEGMENT[locale]);
  const excluded = [...NOT_PAGES, ...prefixed].map((segment) => `${segment}(?:/|$)`).join('|');
  return {
    beforeFiles: [],
    afterFiles: [
      { source: '/', destination: `/${ENGLISH}` },
      { source: `/:path((?!${excluded}).+)`, destination: `/${ENGLISH}/:path` },
    ],
    fallback: [],
  };
}
