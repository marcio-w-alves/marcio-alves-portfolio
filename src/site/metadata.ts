import type { Metadata } from 'next';
import type { TopicId } from '@/core/chat/topic-id';
import { interpolate } from '@/core/i18n/format';
import type { Knowledge } from '@/core/knowledge/schema';
import { topicPath } from './routes';
import type { SiteContent } from './site-content';
import type { SiteCopy } from './site-copy';

/** The share card every page uses, rendered once from `opengraph-image`. */
const SHARE_IMAGE = '/opengraph-image';
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** What every page inherits: the site's name, its address, and how a share card reads. */
export function rootMetadata({ profile }: Knowledge, copy: SiteCopy, siteUrl: URL): Metadata {
  const { title, description } = copy;
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
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// Declared on the home page rather than inherited from the root: a canonical
// every route inherited would point each of them at the home page.
export const homeMetadata: Metadata = { alternates: { canonical: '/' } };

// A page that sets openGraph or twitter replaces the root's whole object, so
// each topic page restates the card in full — without it, a shared topic link
// showed no image, no type and the small Twitter card.
export function topicMetadata(
  { knowledge, topicCatalog }: SiteContent,
  copy: SiteCopy,
  id: TopicId,
): Metadata {
  const topic = topicCatalog.topicById(id);
  const title = interpolate(copy.topicTitle, { topic: topic.label });
  const { description } = topic;
  const image = { url: SHARE_IMAGE, ...SHARE_IMAGE_SIZE, alt: copy.shareImageAlt };
  return {
    title,
    description,
    alternates: { canonical: topicPath(id) },
    openGraph: {
      type: 'website',
      siteName: knowledge.profile.name,
      locale: copy.openGraphLocale,
      url: topicPath(id),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
