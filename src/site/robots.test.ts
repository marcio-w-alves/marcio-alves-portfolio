import { expect, it } from 'vitest';
import { robots } from './robots';

it('keeps crawlers out of the API, and points them to the sitemap', () => {
  expect(robots(new URL('https://ada.example'))).toEqual({
    rules: { userAgent: '*', allow: '/', disallow: ['/api'] },
    sitemap: 'https://ada.example/sitemap.xml',
  });
});
