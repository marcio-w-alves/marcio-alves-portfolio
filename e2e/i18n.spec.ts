import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_LOCALE, LOCALE_SEGMENT, type Locale } from '@/core/i18n/locale';
import { pagePath } from '@/site/routes';
import { holdNextAnswer } from './support/assistant';
import { pagesIn, published, unpublished } from './support/profile';

/**
 * A language the site can speak but the profile has not switched on (D30) is
 * unreachable: no page, no sitemap entry, no alternate, no switcher. The tests
 * are generated per such language, so once every language is published there
 * are none — nothing is skipped.
 */
for (const locale of unpublished) {
  const prefix = `/${LOCALE_SEGMENT[locale]}`;
  const { ui } = pagesIn(locale);

  test(`${locale} is not reachable until the profile publishes it`, async ({ page, request }) => {
    for (const path of [prefix, `${prefix}/skills`]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain(`${prefix}<`);
    expect(sitemap).not.toContain(`${prefix}/`);

    for (const path of ['/', '/skills']) {
      await page.goto(path);
      await expect(page.locator(`link[hreflang="${locale}"]`)).toHaveCount(0);
      await expect(page.getByRole('link', { name: ui.language.name })).toHaveCount(0);
      await expect(page.locator(`a[href="${prefix}"], a[href^="${prefix}/"]`)).toHaveCount(0);
    }
  });
}

const english = pagesIn(DEFAULT_LOCALE);

/** Every address the page requests that starts with /en, which the site must never write. */
function englishPrefixRequests(page: Page): string[] {
  const requested: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/^\/en(\/|$)/.test(pathname)) requested.push(pathname);
  });
  return requested;
}

function questionOf(locale: Locale, index: number): string {
  const question = pagesIn(locale).topicCatalog.topicById('experience').questions[index]?.question;
  if (!question) throw new Error(`The experience page offers no question ${String(index)}.`);
  return question;
}

async function ask(page: Page, locale: Locale, question: string) {
  const { ui } = pagesIn(locale);
  const composer = page.getByRole('textbox', { name: ui.composer.label });
  await composer.fill(question);
  await composer.press('Enter');
  const conversation = page.getByRole('list', { name: ui.conversation.label });
  await expect(conversation.getByText(question)).toBeVisible();
  await expect(conversation).toHaveAttribute('aria-busy', 'false');
}

/** A question as the conversation reads it back, in the page's language. */
function asked(page: Page, locale: Locale, question: string) {
  return page.getByText(`${pagesIn(locale).ui.conversation.youAsked} ${question}`);
}

function switcher(page: Page, locale: Locale) {
  return page.getByRole('navigation', { name: pagesIn(locale).ui.shell.language });
}

/**
 * A published language besides English: read the portfolio in it and come
 * back. Run against a build that publishes it — `pnpm test:e2e:preview`
 * until the profile does.
 */
for (const locale of published.filter((candidate) => candidate !== DEFAULT_LOCALE)) {
  const theirs = pagesIn(locale);
  const name = theirs.ui.language.name;
  const englishName = english.ui.language.name;

  test(`switching to ${locale} and back keeps each language's conversation`, async ({ page }) => {
    const requested = englishPrefixRequests(page);
    const englishQuestion = questionOf(DEFAULT_LOCALE, 0);
    const theirQuestion = questionOf(locale, 1);
    await page.goto('/experience');
    await ask(page, DEFAULT_LOCALE, englishQuestion);

    await switcher(page, DEFAULT_LOCALE).getByRole('link', { name }).click();
    await expect(page).toHaveURL(pagePath(locale, 'experience'));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(asked(page, locale, englishQuestion)).toHaveCount(0);
    await ask(page, locale, theirQuestion);

    await switcher(page, locale).getByRole('link', { name: englishName }).click();
    await expect(page).toHaveURL(/\/experience$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(asked(page, DEFAULT_LOCALE, englishQuestion)).toHaveCount(1);
    await expect(asked(page, DEFAULT_LOCALE, theirQuestion)).toHaveCount(0);

    await switcher(page, DEFAULT_LOCALE).getByRole('link', { name }).click();
    await expect(asked(page, locale, theirQuestion)).toHaveCount(1);
    await expect(asked(page, locale, englishQuestion)).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test(`an answer on its way survives a switch to ${locale} and back`, async ({ page }) => {
    const chatRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/chat') chatRequests.push(request.url());
    });
    await page.goto('/experience');
    const release = await holdNextAnswer(page);
    const composer = page.getByRole('textbox', { name: english.ui.composer.label });
    await composer.fill(questionOf(DEFAULT_LOCALE, 0));
    await composer.press('Enter');
    const conversation = page.getByRole('list', { name: english.ui.conversation.label });
    await expect(conversation).toHaveAttribute('aria-busy', 'true');

    await switcher(page, DEFAULT_LOCALE).getByRole('link', { name }).click();
    await expect(page).toHaveURL(pagePath(locale, 'experience'));
    await switcher(page, locale).getByRole('link', { name: englishName }).click();
    await expect(page).toHaveURL(/\/experience$/);
    release();

    await expect(conversation).toHaveAttribute('aria-busy', 'false');
    await expect(
      conversation.getByRole('article', { name: english.ui.conversation.answer }).last(),
    ).toContainText(/\S/);
    expect(chatRequests).toHaveLength(1);
  });

  test(`the switcher is reached and followed from the keyboard, in ${locale}`, async ({ page }) => {
    await page.goto('/skills');
    const target = switcher(page, DEFAULT_LOCALE).getByRole('link', { name });
    for (let presses = 0; presses < 60; presses += 1) {
      if (await target.evaluate((link) => link === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }

    await expect(target).toBeFocused();
    expect(await target.evaluate((link) => link.matches(':focus-visible'))).toBe(true);
    expect(await target.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe('none');
    const box = await target.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(pagePath(locale, 'skills'));
    await expect(switcher(page, locale).getByRole('link', { name })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test(`an unknown ${locale} address is not found, in ${locale}`, async ({ page }) => {
    const response = await page.goto(`${pagePath(locale, 'overview')}/nope`);

    expect(response?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { name: theirs.site.notFound.title })).toBeVisible();
  });

  test(`a crawler reads the ${locale} pages as ${locale}`, async ({ page, request }) => {
    const path = pagePath(locale, 'experience');
    await page.goto(path);
    const href = (selector: string) => page.locator(selector).getAttribute('href');
    const pathOf = async (selector: string) => new URL(String(await href(selector))).pathname;

    await expect(page).toHaveTitle(
      theirs.site.topicTitle
        .replace('{topic}', theirs.topicCatalog.topicById('experience').label)
        .replace('{name}', theirs.knowledge.profile.name),
    );
    expect(await pathOf('link[rel="canonical"]')).toBe(path);
    expect(await pathOf(`link[hreflang="${locale}"]`)).toBe(path);
    expect(await pathOf('link[hreflang="en"]')).toBe('/experience');
    expect(await pathOf('link[hreflang="x-default"]')).toBe('/experience');

    const image = new URL(
      String(await page.locator('meta[property="og:image"]').getAttribute('content')),
    );
    expect(image.pathname).toBe(`${pagePath(locale, 'overview')}/brand/share-image.png`);
    const png = await (await request.get(image.pathname)).body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);

    await page.goto(pagePath(locale, 'overview'));
    const json = await page.locator('script[type="application/ld+json"]').textContent();
    const { '@graph': graph } = JSON.parse(String(json)) as {
      '@graph': Record<string, unknown>[];
    };
    expect(graph[0]).toMatchObject({ inLanguage: locale });
    expect(graph[2]).toMatchObject({ jobTitle: theirs.knowledge.profile.title });

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect([...sitemap.matchAll(/<loc>/g)]).toHaveLength(published.length * 6);
    expect(sitemap).toContain(`hreflang="${locale}"`);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test(`the drawer offers ${locale}`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: english.ui.shell.openNavigation }).click();
      const link = switcher(page, DEFAULT_LOCALE).getByRole('link', { name });
      await expect(link).toBeVisible();

      await link.tap();

      await expect(page).toHaveURL(pagePath(locale, 'overview'));
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
    });
  });
}
