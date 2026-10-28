import type { MetadataRoute } from 'next';
import { siteUrl } from '@/env';

// No lastModified: the page has no edit date to report, and the build time
// would claim a change on every deployment.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL('/', siteUrl()).href }];
}
