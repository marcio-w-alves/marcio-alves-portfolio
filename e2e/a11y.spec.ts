import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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
  return page.getByRole('article', { name: "Answer from Marcio's portfolio assistant" });
}

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the welcome screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: "Hi, I'm Marcio" })).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test('a fast-path answer with rich blocks has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    const answer = await askSuggestedQuestion(page, 'His career');
    await expect(answer.getByRole('group', { name: 'Answer actions' })).toBeVisible();
    await expect(answer.getByRole('list').first()).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });

  test('a failed answer has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.fulfill({ status: 500 }));
    await page.goto('/');
    const answer = await askSuggestedQuestion(page, 'His career');
    await expect(answer.getByRole('alert')).toContainText("Couldn't load this answer");

    expect(await violations(page)).toEqual([]);
  });

  test('every topic page has no WCAG 2.1 AA violations', async ({ page }) => {
    for (const path of ['/experience', '/skills', '/projects', '/philosophy', '/education']) {
      await page.goto(path);
      await expect(page.getByRole('list', { name: 'Conversation' })).toBeVisible();
      expect(await violations(page), path).toEqual([]);
    }
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the open navigation drawer has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('navigation', { name: 'Topics' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Topics' }).getByRole('link').first(),
    ).toBeFocused();

    expect(await violations(page)).toEqual([]);
  });
});
