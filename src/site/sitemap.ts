import type { MetadataRoute } from 'next';
import { TOPIC_IDS } from '@/core/assistant/topics';
import { topicPath } from './routes';

// No lastModified: the pages have no edit date to report, and the build time
// would claim a change on every deployment.
export function sitemap(siteUrl: URL): MetadataRoute.Sitemap {
  return TOPIC_IDS.map((topic) => ({ url: new URL(topicPath(topic), siteUrl).href }));
}
