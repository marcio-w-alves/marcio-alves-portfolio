import type { TopicId } from '../core/chat/topic-id';
import { DEFAULT_LOCALE, LOCALE_SEGMENT, type Locale } from '../core/i18n/locale';

/** The page about the site itself, which a language has once its profile copy writes one. */
export const ABOUT_PAGE = 'about-this-site';

/** A page of the site, at the same slug in every language that has it. */
export type SitePage = TopicId | typeof ABOUT_PAGE;

/** The published language a route segment serves, or null for any other segment. */
export function localeFromSegment(segment: string, published: readonly Locale[]): Locale | null {
  return published.find((locale) => LOCALE_SEGMENT[locale] === segment) ?? null;
}

/** The address prefix of a language: none for English, `/pt` for Portuguese. */
function prefixOf(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? '' : `/${LOCALE_SEGMENT[locale]}`;
}

/** A page in a language: the overview is the language's home page. */
export function pagePath(locale: Locale, page: SitePage): string {
  const path = page === 'overview' ? '' : `/${page}`;
  return `${prefixOf(locale)}${path}` || '/';
}

/** The same page in each of `locales`: the published languages that have it. */
export function counterparts(
  page: SitePage,
  locales: readonly Locale[],
): Partial<Record<Locale, string>> {
  return Object.fromEntries(locales.map((locale) => [locale, pagePath(locale, page)]));
}

/** A file the site generates once per language, such as its share image. */
export function assetPath(locale: Locale, name: string): string {
  return `${prefixOf(locale)}/${name}`;
}
