import type { Metadata } from 'next';
import type { TopicId } from '@/core/chat/topic-id';
import type { Knowledge } from '@/core/knowledge/schema';
import { topicPath } from './routes';
import { shareImageAlt } from './share-image';
import type { SiteContent } from './site-content';

/** The share card every page uses, rendered once from `opengraph-image`. */
const SHARE_IMAGE = '/opengraph-image';
const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** What every page inherits: the site's name, its address, and how a share card reads. */
export function rootMetadata({ profile }: Knowledge, siteUrl: URL): Metadata {
  const title = `${profile.name} — ${profile.title}`;
  const description = `Portfolio of ${profile.name}, ${profile.title}. Ask its AI assistant about his documented experience.`;
  return {
    metadataBase: siteUrl,
    title,
    description,
    openGraph: { type: 'website', siteName: profile.name, locale: 'en_US', title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// Declared on the home page rather than inherited from the root: a canonical
// every route inherited would point each of them at the home page.
export const homeMetadata: Metadata = { alternates: { canonical: '/' } };

// A page that sets openGraph or twitter replaces the root's whole object, so
// each topic page restates the card in full — without it, a shared topic link
// showed no image, no type and the small Twitter card.
export function topicMetadata({ knowledge, topicCatalog }: SiteContent, id: TopicId): Metadata {
  const topic = topicCatalog.topicById(id);
  const title = `${topic.label} — ${knowledge.profile.name}`;
  const { description } = topic;
  const image = { url: SHARE_IMAGE, ...SHARE_IMAGE_SIZE, alt: shareImageAlt(knowledge) };
  return {
    title,
    description,
    alternates: { canonical: topicPath(id) },
    openGraph: {
      type: 'website',
      siteName: knowledge.profile.name,
      locale: 'en_US',
      url: topicPath(id),
      title,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
