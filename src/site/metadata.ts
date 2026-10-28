import type { Metadata } from 'next';
import type { TopicId } from '@/core/chat/topic-id';
import { interpolate } from '@/core/i18n/format';
import { DEFAULT_LOCALE, type Locale } from '@/core/i18n/locale';
import type { Knowledge } from '@/core/knowledge/schema';
import type { AboutPageCopy } from './about-page';
import { ABOUT_PAGE, assetPath, counterparts, pagePath, type SitePage } from './routes';
import type { SiteContent } from './site-content';
import type { SiteCopy } from './site-copy';

/** The share card of a language's pages, which its own route renders. */
export const SHARE_IMAGE = 'brand/share-image.png';
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

function shareImageOf(locale: Locale, copy: SiteCopy) {
  return {
    url: assetPath(locale, SHARE_IMAGE),
    ...SHARE_IMAGE_SIZE,
    type: 'image/png',
    alt: copy.shareImageAlt,
  };
}

/**
 * The page's own address, and — once more than one language has it — the
 * same page in each of them, English standing in for any other.
 */
function alternatesOf(locale: Locale, page: SitePage, locales: readonly Locale[]) {
  const canonical = pagePath(locale, page);
  if (locales.length < 2) return { canonical };
  return {
    canonical,
    languages: { ...counterparts(page, locales), 'x-default': pagePath(DEFAULT_LOCALE, page) },
  };
}

/** What every page of a language inherits: the site's name, its address, and how a share card reads. */
export function rootMetadata(
  { profile }: Knowledge,
  copy: SiteCopy,
  siteUrl: URL,
  locale: Locale,
): Metadata {
  const { title, description } = copy;
  const image = shareImageOf(locale, copy);
  return {
    metadataBase: siteUrl,
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: profile.name,
      locale: copy.openGraphLocale,
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

// Declared on the home page rather than inherited from the root: a canonical
// every route inherited would point each of them at the home page.
export function homeMetadata(locale: Locale, published: readonly Locale[]): Metadata {
  return { alternates: alternatesOf(locale, 'overview', published) };
}

// A page that sets openGraph or twitter replaces the root's whole object, so
// each topic page restates the card in full — without it, a shared topic link
// showed no image, no type and the small Twitter card.
export function topicMetadata(
  { locale, knowledge, topicCatalog }: SiteContent,
  copy: SiteCopy,
  id: TopicId,
  published: readonly Locale[],
): Metadata {
  const topic = topicCatalog.topicById(id);
  const title = interpolate(copy.topicTitle, { topic: topic.label });
  const { description } = topic;
  const image = shareImageOf(locale, copy);
  return {
    title,
    description,
    alternates: alternatesOf(locale, id, published),
    openGraph: {
      type: 'website',
      siteName: knowledge.profile.name,
      locale: copy.openGraphLocale,
      url: pagePath(locale, id),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** The page about the site, shared as an article; `locales` are the languages that have one. */
export function aboutMetadata(
  about: AboutPageCopy,
  copy: SiteCopy,
  { siteName, locale, locales }: { siteName: string; locale: Locale; locales: readonly Locale[] },
): Metadata {
  const title = interpolate(copy.topicTitle, { topic: about.title });
  const { description } = about;
  const image = shareImageOf(locale, copy);
  return {
    title,
    description,
    alternates: alternatesOf(locale, ABOUT_PAGE, locales),
    openGraph: {
      type: 'article',
      siteName,
      locale: copy.openGraphLocale,
      url: pagePath(locale, ABOUT_PAGE),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
