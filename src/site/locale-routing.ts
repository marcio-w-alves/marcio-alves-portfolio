import { DEFAULT_LOCALE, LOCALE_SEGMENT, type Locale } from '../core/i18n/locale';

const ENGLISH = LOCALE_SEGMENT[DEFAULT_LOCALE];

/**
 * Paths the rewrite leaves alone: the API, Next's own assets, and the English
 * segment itself, which the proxy's rewrite of the home page arrives at.
 * Without it `/en` was rewritten again, to `/en/en`, and answered not-found.
 */
const NOT_PAGES = ['api', '_next', ENGLISH];

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

/** Where the home page is served from: the English segment. `src/proxy.ts` rewrites to it. */
export const HOME_DESTINATION = `/${ENGLISH}`;

/**
 * Every other page address without a published language's prefix is English, served
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
    // The home page is not here: on Vercel this rewrite of `/` sent a client
    // navigation's data requests to `/en/index.segments/…`, which the
    // catch-all answered with not-found. `src/proxy.ts` rewrites it instead.
    afterFiles: [{ source: `/:path((?!${excluded}).+)`, destination: `/${ENGLISH}/:path` }],
    fallback: [],
  };
}
