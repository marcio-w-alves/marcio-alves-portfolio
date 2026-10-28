import type { MetadataRoute } from 'next';

export function robots(siteUrl: URL): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api'] },
    sitemap: new URL('/sitemap.xml', siteUrl).href,
  };
}
