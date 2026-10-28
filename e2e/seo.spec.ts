import { expect, test } from '@playwright/test';

/**
 * What a crawler and a link preview read from the production build. Absolute
 * URLs are resolved against the canonical origin the build was given, which
 * is why each one is compared by path and by agreement with the canonical.
 */

test('the home page describes itself to search engines and link previews', async ({ page }) => {
  await page.goto('/');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

  await expect(page).toHaveTitle('Marcio Alves — Frontend Engineer');
  expect(await meta('meta[name="description"]')).toMatch(/^Portfolio of Marcio Alves/);
  expect(canonical).toMatch(/^https?:\/\/[^/]+\/?$/);
  expect(await meta('meta[property="og:title"]')).toBe('Marcio Alves — Frontend Engineer');
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');

  const ogImage = new URL(String(await meta('meta[property="og:image"]')));
  expect(ogImage.origin).toBe(new URL(String(canonical)).origin);
  expect(ogImage.pathname).toBe('/opengraph-image');
  expect(await meta('meta[name="twitter:image"]')).toBe(ogImage.href);
  expect(await meta('meta[property="og:image:alt"]')).toBe(
    'Marcio Alves, Staff-level Frontend Engineer',
  );
});

test('the home page identifies Marcio as a schema.org Person', async ({ page }) => {
  await page.goto('/');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const person = JSON.parse(String(json)) as Record<string, unknown>;

  expect(person).toMatchObject({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Marcio Alves',
    jobTitle: 'Staff-level Frontend Engineer',
    sameAs: ['https://www.linkedin.com/in/marcio-montenegro', 'https://github.com/marcio-w-alves'],
  });
  expect(new URL(String(person.url)).href).toBe(new URL(String(canonical)).href);
  expect(person.knowsAbout).toEqual(expect.arrayContaining(['React', 'TypeScript', 'Next.js']));
});

test('the social image is a 1200×630 PNG', async ({ request }) => {
  const response = await request.get('/opengraph-image');
  const png = await response.body();

  expect(response.headers()['content-type']).toBe('image/png');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('the page declares a tab icon the server delivers', async ({ page, request }) => {
  await page.goto('/');
  const href = String(await page.locator('link[rel="icon"]').getAttribute('href'));

  const icon = await request.get(href);

  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toBe('image/png');
});

test('robots.txt keeps crawlers out of the API and points to the sitemap', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();

  expect(robots).toMatch(/^Allow: \/$/m);
  expect(robots).toMatch(/^Disallow: \/api$/m);
  expect(robots).toMatch(/^Sitemap: https?:\/\/[^/]+\/sitemap\.xml$/m);
});

test('the sitemap lists the home page and every topic page at their canonical addresses', async ({
  page,
  request,
}) => {
  const canonicals: string[] = [];
  for (const path of ['/', '/experience', '/skills', '/projects', '/philosophy', '/education']) {
    await page.goto(path);
    canonicals.push(String(await page.locator('link[rel="canonical"]').getAttribute('href')));
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  expect(locations).toEqual(canonicals.map((canonical) => new URL(canonical).href));
});
