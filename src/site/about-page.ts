import type { Metadata } from 'next';
import { interpolate } from '@/core/i18n/format';
import type { SiteCopy } from './site-copy';

/** Where the page about the site itself lives. */
export const ABOUT_PATH = '/about-this-site';

/**
 * The one page without a chat: an article about how the site is built, in the
 * owner's words. A profile without one has no such page and no sidebar link.
 */
export interface AboutPageCopy {
  /** The sidebar's link to it. */
  readonly label: string;
  /** The page's heading. */
  readonly title: string;
  /** Its search-result snippet, at most 160 characters. */
  readonly description: string;
  /** The article, in the same Markdown the answers are written in. */
  readonly markdown: string;
}

const SHARE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630 } as const;

export function aboutMetadata(about: AboutPageCopy, copy: SiteCopy, siteName: string): Metadata {
  const title = interpolate(copy.topicTitle, { topic: about.title });
  const image = { ...SHARE_IMAGE, alt: copy.shareImageAlt };
  return {
    title,
    description: about.description,
    alternates: { canonical: ABOUT_PATH },
    openGraph: {
      type: 'article',
      siteName,
      locale: copy.openGraphLocale,
      url: ABOUT_PATH,
      title,
      description: about.description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: about.description,
      images: [image],
    },
  };
}
