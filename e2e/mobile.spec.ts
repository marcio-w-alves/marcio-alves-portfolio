import { expect, test } from '@playwright/test';
import { answers } from './support/assistant';

test('the navigation drawer opens from the menu, closes on Escape and leads to a topic', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  const topicsNav = page.getByRole('navigation', { name: 'Topics' });
  await expect(topicsNav).toBeHidden();

  await menu.click();

  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(topicsNav).toBeVisible();
  await expect(topicsNav.getByRole('link', { name: 'Overview' })).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(topicsNav).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();

  await menu.click();
  await topicsNav.getByRole('link', { name: 'Projects' }).click();

  await expect(page).toHaveURL(/\/projects$/);
  await expect(topicsNav).toBeHidden();
  await expect(
    answers(page).first().getByText('Beyond his day job, Marcio builds his own products.'),
  ).toBeVisible();
  await menu.click();
  await expect(topicsNav.getByRole('link', { name: 'Projects' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('project cards fit a narrow phone: features wrap inside their chip, the status sits under the name', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/projects');
  const card = page.getByRole('article', { name: 'Project: EvCopilot' });
  await expect(card).toBeVisible();

  for (const chip of await card.getByRole('listitem').all()) {
    const fits = await chip.evaluate((item) => item.scrollHeight <= item.clientHeight + 1);
    expect(fits, await chip.innerText()).toBe(true);
  }

  const name = await card.getByRole('heading', { name: 'EvCopilot' }).boundingBox();
  const status = await card.getByText('iPhone beta · invite only').boundingBox();
  const category = await card.getByText('Electric mobility · Brazil').boundingBox();
  expect(status && name && status.y).toBeGreaterThan((name?.y ?? 0) + (name?.height ?? 0));
  expect(category?.height ?? 0).toBeLessThan(24);
});
