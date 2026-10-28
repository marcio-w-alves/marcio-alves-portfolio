import type { Metadata } from 'next';
import type { TopicId } from '@/core/chat/topic-id';
import type { Knowledge } from '@/core/knowledge/schema';
import { topicPath } from './routes';
import type { SiteContent } from './site-content';

/** What every page inherits: the site's name, its address, and how a share card reads. */
export function rootMetadata({ profile }: Knowledge, siteUrl: URL): Metadata {
  const title = `${profile.name} — Frontend Engineer`;
  const description = `Portfolio of ${profile.name}, frontend engineer, with an AI assistant grounded in his documented experience.`;
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

export function topicMetadata({ knowledge, topicCatalog }: SiteContent, id: TopicId): Metadata {
  const topic = topicCatalog.topicById(id);
  const title = `${topic.label} — ${knowledge.profile.name}`;
  return {
    title,
    description: topic.intro,
    alternates: { canonical: topicPath(id) },
    openGraph: { title, description: topic.intro },
    twitter: { title, description: topic.intro },
  };
}
