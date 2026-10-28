import { expect, test } from '@playwright/test';

test('a visitor picks the dark theme and keeps it on the next visit, from the first frame', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('group', { name: 'Theme' }).getByText('Dark', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();

  await expect(html).toHaveAttribute('data-theme', 'dark');
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBackground).not.toBe('rgb(255, 255, 255)');

  // The pre-paint script decides before any of the page's own code runs.
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-theme-choice', 'dark');
});

test('Auto follows the system, light or dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/experience');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Auto' })).toBeChecked();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
