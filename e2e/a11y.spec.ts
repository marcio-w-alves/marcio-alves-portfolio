import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_LOCALE } from '@/core/i18n/locale';
import { pagePath } from '@/site/routes';
import { firstSuggestion, pagePathsIn, pagesIn, published, record, ui } from './support/profile';

/**
 * Every key state of the home page, scanned by axe against WCAG 2.1 A and AA.
 * Each state is reached the way a visitor reaches it; only the failure is
 * forced, at the network, because the real endpoint does not fail on demand.
 */

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Contrast is measured on what is painted, so a scan must never land halfway
// through a fade or a slide; reduced motion makes every transition instant.
test.use({ reducedMotion: 'reduce' });

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
  return violations.map(({ id, help, nodes }) => ({
    id,
    help,
    targets: nodes.map(({ target }) => target.join(' ')),
  }));
}

async function askSuggestedQuestion(page: Page, label: string) {
  await page.getByRole('button', { name: label }).click();
  return page.getByRole('article', { name: ui.conversation.answer });
}

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the welcome screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: record.welcome.heading }),
    ).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test('a fast-path answer with rich blocks has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    const answer = await askSuggestedQuestion(page, firstSuggestion().label);
    await expect(answer.getByRole('group', { name: ui.actions.group })).toBeVisible();
    await expect(answer.getByRole('list').first()).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test('a failed answer has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.fulfill({ status: 500 }));
    await page.goto('/');
    const answer = await askSuggestedQuestion(page, firstSuggestion().label);
    await expect(answer.getByRole('alert')).toContainText("Couldn't load this answer");

    expect(await violations(page)).toEqual([]);
  });

  test('every topic page has no WCAG 2.1 AA violations', async ({ page }) => {
    for (const path of ['/experience', '/skills', '/projects', '/philosophy', '/education']) {
      await page.goto(path);
      await expect(page.getByRole('list', { name: ui.conversation.label })).toBeVisible();
      expect(await violations(page), path).toEqual([]);
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the welcome screen, with its contact and résumé links, has no WCAG 2.1 AA violations', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('list', { name: ui.welcome.contact }).getByRole('link').first(),
    ).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test('the open navigation drawer has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: ui.shell.openNavigation }).click();
    await expect(page.getByRole('navigation', { name: ui.shell.topics })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: ui.shell.topics }).getByRole('link').first(),
    ).toBeFocused();

    expect(await violations(page)).toEqual([]);
  });
});

test('the page about the site has no WCAG 2.1 AA violations', async ({ page }) => {
  await page.goto('/about-this-site');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test.describe('beyond WCAG AA', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('every page keeps its headings in order, from the h1 down', async ({ page }) => {
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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withRules(['heading-order', 'page-has-heading-one', 'landmark-one-main'])
        .analyze();
      expect(
        violations.map(({ id }) => id),
        path,
      ).toEqual([]);
    }
  });

  test('the first Tab offers to skip past the topics, straight to the conversation', async ({
    page,
  }) => {
    await page.goto('/experience');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: ui.shell.skipToConversation });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('main')).toBeFocused();
  });

  test('the contact link in the sidebar is a comfortable touch target', async ({ page }) => {
    await page.goto('/');
    const box = await page.getByRole('link', { name: ui.shell.getInTouch }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

test.describe('in the dark theme', () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });

  test('every page has no WCAG 2.1 AA violations', async ({ page }) => {
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
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
      expect(await violations(page), path).toEqual([]);
    }
  });
});

/**
 * The same scans in every other language the site publishes: its pages, an
 * answer with rich blocks, a failed answer and the drawer, each reached the
 * way a visitor reaches it there.
 */
for (const locale of published.filter((candidate) => candidate !== DEFAULT_LOCALE)) {
  const theirs = pagesIn(locale);
  const [suggestion] = theirs.topicCatalog.suggestedQuestions('overview', 0, 4);
  if (!suggestion) throw new Error(`The ${locale} home page suggests no question.`);
  const home = pagePath(locale, 'overview');

  test.describe(`in ${locale}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('every page has no WCAG 2.1 AA violations and declares its language', async ({ page }) => {
      for (const path of pagePathsIn(locale)) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
        expect(await violations(page), path).toEqual([]);
      }
    });

    test('a fast-path answer with rich blocks has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto(home);
      await page.getByRole('button', { name: suggestion.short }).click();
      const answer = page.getByRole('article', { name: theirs.ui.conversation.answer });
      await expect(answer.getByRole('group', { name: theirs.ui.actions.group })).toBeVisible();
      await expect(answer.getByRole('list').first()).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });

    test('a failed answer has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.route('**/api/chat', (route) => route.fulfill({ status: 500 }));
      await page.goto(home);
      await page.getByRole('button', { name: suggestion.short }).click();
      const answer = page.getByRole('article', { name: theirs.ui.conversation.answer });
      await expect(answer.getByRole('alert')).toContainText(theirs.ui.failure.title);

      expect(await violations(page)).toEqual([]);
    });
  });

  test.describe(`in ${locale}, on a phone`, () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('the open navigation drawer has no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto(home);
      await page.getByRole('button', { name: theirs.ui.shell.openNavigation }).click();
      await expect(page.getByRole('navigation', { name: theirs.ui.shell.topics })).toBeVisible();

      expect(await violations(page)).toEqual([]);
    });
  });
}
