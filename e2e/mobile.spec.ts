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
  await expect(topicsNav.getByRole('button', { name: 'Overview' })).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(topicsNav).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();

  await menu.click();
  await topicsNav.getByRole('button', { name: 'Projects' }).click();

  await expect(topicsNav).toBeHidden();
  await expect(
    answers(page).last().getByText('Beyond his day job, Marcio builds his own products.'),
  ).toBeVisible();
  await menu.click();
  await expect(topicsNav.getByRole('button', { name: 'Projects' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
