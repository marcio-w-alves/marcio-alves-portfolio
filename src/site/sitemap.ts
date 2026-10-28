import type { MetadataRoute } from 'next';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import { topicPath } from './routes';

// No lastModified: the pages have no edit date to report, and the build time
// would claim a change on every deployment.
export function sitemap(siteUrl: URL, extraPaths: readonly string[] = []): MetadataRoute.Sitemap {
  return [...TOPIC_IDS.map(topicPath), ...extraPaths].map((path) => ({
    url: new URL(path, siteUrl).href,
  }));
}
