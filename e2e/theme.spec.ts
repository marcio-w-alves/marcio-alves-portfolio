import { expect, test } from '@playwright/test';

test('a visitor picks the dark theme and keeps it on the next visit, from the first frame', async ({
  page,
}) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('group', { name: 'Theme' }).getByTitle('Dark').click();
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

test('the switcher shows three separate icon buttons, Auto first and checked, centred in the sidebar', async ({
  page,
}) => {
  await page.goto('/');
  const group = page.getByRole('group', { name: 'Theme' });
  const radios = group.getByRole('radio');
  await expect(radios).toHaveCount(3);
  expect(
    await radios.evaluateAll((items) => items.map((item) => (item as HTMLInputElement).value)),
  ).toEqual(['system', 'light', 'dark']);
  await expect(group.getByRole('radio', { name: 'Auto' })).toBeChecked();

  // Icons only: no name painted beside them, and no option drawn over the next.
  const boxes = await group.locator('label').evaluateAll((labels) =>
    labels.map((label) => {
      const { left, right, width } = label.getBoundingClientRect();
      const name = label.querySelector('span')?.getBoundingClientRect();
      return { left, right, width, nameWidth: name?.width ?? 0 };
    }),
  );
  for (const [index, box] of boxes.entries()) {
    expect(box.nameWidth).toBeLessThanOrEqual(1);
    expect(box.width).toBeGreaterThanOrEqual(32);
    const next = boxes[index + 1];
    if (next) expect(box.right).toBeLessThanOrEqual(next.left);
  }

  const sidebar = await page.getByRole('complementary').boundingBox();
  const switcher = await group.boundingBox();
  if (!sidebar || !switcher) throw new Error('The sidebar or the switcher is not laid out.');
  const centre = (box: { x: number; width: number }) => box.x + box.width / 2;
  expect(Math.abs(centre(switcher) - centre(sidebar))).toBeLessThanOrEqual(2);
});
