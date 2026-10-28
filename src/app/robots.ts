import type { MetadataRoute } from 'next';
import { siteUrl } from '@/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api'] },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  };
}
