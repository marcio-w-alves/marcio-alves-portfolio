import { expect, test } from '@playwright/test';
import { record, site } from './support/profile';

/**
 * What a crawler and a link preview read from the production build. Absolute
 * URLs are resolved against the canonical origin the build was given, which
 * is why each one is compared by path and by agreement with the canonical.
 */

test('the home page describes itself to search engines and link previews', async ({ page }) => {
  await page.goto('/');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

  await expect(page).toHaveTitle(site.title);
  expect(await meta('meta[name="description"]')).toBe(site.description);
  expect(canonical).toMatch(/^https?:\/\/[^/]+\/?$/);
  expect(await meta('meta[property="og:title"]')).toBe(site.title);
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');

  const ogImage = new URL(String(await meta('meta[property="og:image"]')));
  expect(ogImage.origin).toBe(new URL(String(canonical)).origin);
  expect(ogImage.pathname).toBe('/opengraph-image');
  expect(await meta('meta[name="twitter:image"]')).toBe(ogImage.href);
  expect(await meta('meta[property="og:image:alt"]')).toBe(site.shareImageAlt);
});

test('the home page is a schema.org ProfilePage about its owner as a Person', async ({ page }) => {
  await page.goto('/');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const { '@graph': graph } = JSON.parse(String(json)) as {
    '@graph': Record<string, unknown>[];
  };
  expect(graph.map((node) => node['@type'])).toEqual(['WebSite', 'ProfilePage', 'Person']);
  const person = graph[2] ?? {};

  expect(person).toMatchObject({
    '@type': 'Person',
    name: record.profile.name,
    jobTitle: record.profile.title,
    sameAs: [record.contact.linkedin, record.contact.github],
  });
  expect(new URL(String(person.url)).href).toBe(new URL(String(canonical)).href);
  expect(person.knowsAbout).toEqual(record.skills.flatMap(({ items }) => items));
  const current = record.experience.find((role) => role.current);
  expect(person.worksFor).toMatchObject({ '@type': 'Organization', name: current?.company });
});

test('a topic page is shared with its own address, the large card and the site image', async ({
  page,
}) => {
  await page.goto('/experience');
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  const canonical = String(await page.locator('link[rel="canonical"]').getAttribute('href'));
  const description = String(await meta('meta[name="description"]'));

  expect(description.length).toBeLessThanOrEqual(160);
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[property="og:url"]')).toBe(canonical);
  expect(new URL(String(await meta('meta[property="og:image"]'))).pathname).toBe(
    '/opengraph-image',
  );
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');

  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const crumbs = JSON.parse(String(json)) as { '@type': string; itemListElement: unknown[] };
  expect(crumbs['@type']).toBe('BreadcrumbList');
  expect(crumbs.itemListElement).toHaveLength(2);
});

test('phones get a home-screen icon and the page colour for the browser bar', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const touchIcon = String(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'));
  const png = await (await request.get(touchIcon)).body();
  expect(png.readUInt32BE(16)).toBe(180);
  expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toMatch(
    /^#[0-9a-f]{6}$/i,
  );
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

test('the sitemap lists every page at its canonical address', async ({ page, request }) => {
  const canonicals: string[] = [];
  for (const path of [
    '/',
    '/experience',
    '/skills',
    '/projects',
    '/philosophy',
    '/education',
    '/about-this-site',
  ]) {
    await page.goto(path);
    canonicals.push(String(await page.locator('link[rel="canonical"]').getAttribute('href')));
  }
  const sitemap = await (await request.get('/sitemap.xml')).text();

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  expect(locations).toEqual(canonicals.map((canonical) => new URL(canonical).href));
});

test('the page about the site is listed, shared and readable without a chat', async ({
  page,
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/about-this-site</loc>');

  await page.goto('/about-this-site');
  await expect(
    page.getByRole('heading', { level: 1, name: 'How this portfolio is built' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Spending fewer tokens' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Topics' }).getByRole('link', { name: 'About this site' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(await page.locator('meta[property="og:type"]').getAttribute('content')).toBe('article');
});
